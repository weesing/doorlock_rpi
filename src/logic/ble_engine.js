import _ from 'lodash';
import config from '../lib/config';
import logger from '../lib/logger';
import { SecretsLoader } from '../lib/secrets_loader';
import { ConnectionManager } from './connection_manager';
import { DataReceiver } from './data_receiver';

export class BLEEngine extends DataReceiver {
  constructor() {
    super();

    this._connectionManager = null;
  }

  sendOldestPeripheralMessage(peripheralId) {
    if (
      !_.isNil(this._outboxMessageMap[peripheralId]) &&
      this._outboxMessageMap[peripheralId].length > 0
    ) {
      // get characteristic for sending.
      const characteristic =
        this.connectionManager.getPeripheralCharacteristics(peripheralId);
      if (_.isNil(characteristic)) {
        return;
      }
      // send oldest message
      const pending = this._outboxMessageMap[peripheralId].shift();
      logger.info(`[${peripheralId}] Sending ${pending} to ${peripheralId}`);
      characteristic.write(Buffer.from(pending));
    }
  }

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

  async sendInitialPeripheralSync(peripheralId) {
    super.sendInitialPeripheralSync(peripheralId);

    // Send lock MAC intialization settings
    if (peripheralId === this.lockMAC) {
      if (
        _.isNil(this._outboxMessageMap[this.lockMAC]) ||
        this._outboxMessageMap[this.lockMAC].length > 0
      ) {
        // Clear all the outbox messages
        this._outboxMessageMap[this.lockMAC] = [];
      }

      // Send all the settings.
      logger.info(`Sending settings....`);
      const mainServoSettings = _.get(config, `lock.settings.main_servo`);
      const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
      const adxlSettings = _.get(config, `lock.settings.adxl`);

      const delimiter = ';';
      this._outboxMessageMap[this.lockMAC] = [
        `<settings>`,
        `m_unlk=${mainServoSettings.frequencies.unlock}${delimiter}`,
        `m_lk=${mainServoSettings.frequencies.lock}${delimiter}`,
        `m_idle=${mainServoSettings.frequencies.idle}${delimiter}`,
        `l_en=${linearServoSettings.angles.engaged}${delimiter}`,
        `l_disen=${linearServoSettings.angles.disengaged}${delimiter}`,
        `l_step=${linearServoSettings.step}${delimiter}`,
        `adxl_rdcnt=${adxlSettings.max_read_count}${delimiter}`,
        `adxl_lk=${adxlSettings.angles.locked}${delimiter}`,
        `adxl_unlk=${adxlSettings.angles.unlocked}${delimiter}`,
        `</settings>`
      ];
    }
  }

  async onDataReceived(peripheral, data, isNotification) {
    super.onDataReceived(peripheral, data, isNotification);
    const peripheralId = peripheral.id;
    if (peripheralId === this.rfidMAC || peripheralId === this.lockMAC) {
      switch (peripheralId) {
        case this.rfidMAC: {
          const lockCharacteristic =
            this.connectionManager.connectionStatuses[this.lockMAC]
              .characteristic;
          if (!lockCharacteristic) {
            logger.info(`Door lock not connected yet, aborting data sending.`);
            return;
          }
          lockCharacteristic.write(data);
          break;
        }
        case this.lockMAC: {
          // Do nothing.
          break;
        }
      }
    }
  }

  async initBLE() {
    logger.info(`Intitializing BLE...`);

    const dataReceiver = this;
    this._connectionManager = new ConnectionManager(this.peripheralIds);
    this._connectionManager.startConnections(dataReceiver);
  }

  static getInstance() {
    if (this._instance === undefined) {
      this._instance = new this();
    }
    return this._instance;
  }
}
