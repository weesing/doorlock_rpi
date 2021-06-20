import _ from 'lodash';
import config from '../lib/config';
import logger from '../lib/logger';
import { SecretsLoader } from '../lib/secrets_loader';
import { CardsLogic } from './cards';
import { ConnectionManager } from './connection_manager';
import { DataReceiver } from './data_receiver';
import { Outbox } from './outbox';

export class BLEEngine extends DataReceiver {
  constructor() {
    super();

    this._connectionManager = null;

    this._initialPeripheralSyncTimeout = {};
  }

  // Overwrite
  initPeripheralIds() {
    super.initPeripheralIds();

    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);

    this.rfidMAC = secrets.rfidMAC.toLowerCase();
    this.lockMAC = secrets.lockMAC.toLowerCase();

    this.peripheralIds = [this.rfidMAC, this.lockMAC];

    this.meMAC = secrets.nodeMAC.toLowerCase();
  }

  get connectionManager() {
    return this._connectionManager;
  }

  toggleLock() {
    const lockSecret = SecretsLoader.loadSecrets()['lockSecret'];
    this._outbox.sendMessage(this.lockMAC, `lock`, lockSecret);
  }

  sendData(peripheralId, payload) {
    this._outbox.sendMessage(peripheralId, `data`, payload);
  }

  sendPeripheralSettings() {
    // Send lock MAC intialization settings
    // Send all the settings.
    logger.info(`Sending settings....`);
    const mainServoSettings = _.get(config, `lock.settings.main_servo`);
    const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
    const adxlSettings = _.get(config, `lock.settings.adxl`);

    for (const setting of [
      { tag: 'm_xlk', value: mainServoSettings.frequencies.unlock },
      { tag: 'm_lk', value: mainServoSettings.frequencies.lock },
      { tag: 'm_idl', value: mainServoSettings.frequencies.idle },
      { tag: 'l_en', value: linearServoSettings.angles.engaged },
      { tag: 'l_xen', value: linearServoSettings.angles.disengaged },
      { tag: 'l_step', value: linearServoSettings.step },
      { tag: 'l_ms', value: linearServoSettings.ms },
      { tag: `a_rdct`, value: adxlSettings.max_read_count },
      { tag: `a_lk`, value: adxlSettings.angles.locked },
      { tag: `a_xlk`, value: adxlSettings.angles.unlocked }
    ]) {
      this._outbox.sendMessage(this.lockMAC, setting.tag, `${setting.value}`);
    }
  }

  async getLockSetting(settingTag) {
    this._outbox.sendMessage(this.lockMAC, `get_${settingTag}`, `;`);
    return await new Promise((resolve) => {
      this.settingPromiseResolves[settingTag] = resolve;
    }).then((result) => {
      logger.info(`Retrieved result ${result}`);
    });
  }

  clearInitialSyncTimeout(peripheralId) {
    if (this._initialPeripheralSyncTimeout[peripheralId]) {
      logger.info(
        `[${peripheralId}] Clearing existing initial sync timeout...`
      );
      clearTimeout(this._initialPeripheralSyncTimeout[peripheralId]);
      this._initialPeripheralSyncTimeout[peripheralId] = null;
    }
  }

  createInitialSyncTimeout(peripheralId) {
    this.clearInitialSyncTimeout(peripheralId);
    this._initialPeripheralSyncTimeout[peripheralId] = setTimeout(() => {
      this.sendPeripheralSettings(peripheralId);
    }, _.get(config, `lock.timeout`));
    logger.info(`[${peripheralId}] Initial sync timeout created.`);
  }

  async onPeripheralSubscribed(peripheralId) {
    super.onPeripheralSubscribed(peripheralId);

    const characteristic =
      this.connectionManager.getPeripheralCharacteristic(peripheralId);
    logger.info(`Peripheral ${peripheralId} subscribed.`);
    if (_.isNil(characteristic)) {
      return;
    }

    this.createInitialSyncTimeout(peripheralId);
  }

  async onPeripheralDisconnected(peripheralId) {
    super.onPeripheralDisconnected(peripheralId);

    this.clearInitialSyncTimeout(peripheralId);
  }

  async onDataReceived(peripheral, bufferData, isNotification) {
    super.onDataReceived(peripheral, bufferData, isNotification);
    const peripheralId = peripheral.id;
    if (peripheralId === this.rfidMAC) {
      const lockCharacteristic =
        this.connectionManager.connectionStatuses[this.lockMAC].characteristic;
      if (!lockCharacteristic) {
        logger.info(`Door lock not connected yet, aborting data sending.`);
        return;
      }

      const testKey = bufferData.toString('hex');
      const validKeys = await CardsLogic.getInstance().getKeys();
      let verified = false;
      for (const key of validKeys) {
        if (testKey === key) {
          verified = true;
          break;
        }
      }
      logger.info(
        `${verified ? 'Authorized! Sending lock toggle' : 'Unauthorized'}`
      );
      if (verified) {
        this.toggleLock();
      }
    } else if (peripheralId === this.lockMAC) {
      const dataStringHistory =
        this.peripheralBuffer[this.lockMAC].dataStringHistory;
      for (let i = 0; i < dataStringHistory.length - 1; ++i) {
        const dataString = dataStringHistory[i].dataString;
        if (!dataStringHistory[i].processed) {
          switch (dataString) {
            case '<req_data>\r\n': {
              logger.info(
                `[${peripheralId}] Lock is requesting initial settings data, sending now.`
              );
              this.sendPeripheralSettings();
              break;
            }
            default: {
              if (!dataString.endsWith('\r\n')) {
                break;
              }
              let tempDataString = dataString.replace('\r\n');
              const dataRegex = /^<[0-9a-zA-Z_]+>[0-9]+/g;
              if (tempDataString.match(dataRegex).length === 0) {
                break;
              }
              // e.g. <m_xlk>1800\r\n
              let keyValueToken = tempDataString
                .replace('<', '') // remove first < character
                .split('>');
              logger.info(`[${peripheralId}] Received data ${keyValueToken}`);
              if (keyValueToken.length !== 2) {
                break;
              }
              let settingTag = keyValueToken[0];
              let settingValue = keyValueToken[1];
              if (!this.settingPromiseResolves[settingTag]) {
                break;
              }
              this.settingPromiseResolves[settingTag](settingValue);
              this.settingPromiseResolves[settingTag] = null;
              break;
            }
          }
          this.peripheralBuffer[this.lockMAC].dataStringHistory[
            i
          ].processed = true;
        }
      }
    }
  }

  async initBLE() {
    logger.info(`Intitializing BLE...`);

    const dataReceiver = this;
    this._connectionManager = new ConnectionManager(this.peripheralIds);
    this._connectionManager.startConnections(dataReceiver);

    this._outbox = new Outbox(this.peripheralIds, this._connectionManager);
  }

  static getInstance() {
    if (this._instance === undefined) {
      this._instance = new this();
    }
    return this._instance;
  }
}
