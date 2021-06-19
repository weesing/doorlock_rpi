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

  sendPeripheralSettings(peripheralId) {
    // Send lock MAC intialization settings
    if (peripheralId === this.lockMAC) {
      // Send all the settings.
      logger.info(`Sending settings....`);
      const mainServoSettings = _.get(config, `lock.settings.main_servo`);
      const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
      const adxlSettings = _.get(config, `lock.settings.adxl`);

      this._outbox.sendMessage(
        this.lockMAC,
        `m_xlk`,
        `${mainServoSettings.frequencies.unlock}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `m_lk`,
        `${mainServoSettings.frequencies.lock}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `m_idl`,
        `${mainServoSettings.frequencies.idle}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `l_en`,
        `${linearServoSettings.angles.engaged}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `l_xen`,
        `${linearServoSettings.angles.disengaged}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `l_step`,
        `${linearServoSettings.step}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `l_ms`,
        `${linearServoSettings.ms}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `a_rdct`,
        `${adxlSettings.max_read_count}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `a_lk`,
        `${adxlSettings.angles.locked}`
      );
      this._outbox.sendMessage(
        this.lockMAC,
        `a_xlk`,
        `${adxlSettings.angles.unlocked}`
      );
    }
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
      const verifiedKeys = await CardsLogic.getInstance().getKeys();
      let verified = false;
      console.log(testKey);
      console.log(verifiedKeys);
      for (const key of verifiedKeys) {
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
          if (dataString === '<req_data>\r\n') {
            logger.info(
              `[${peripheralId}] Lock is requesting initial settings data, sending now.`
            );
            this.sendPeripheralSettings(this.lockMAC);
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
