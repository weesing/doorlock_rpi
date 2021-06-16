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

    this.initPeripheralIntervals();
    this.initInitialPeripheralSyncTimeout();
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

  initPeripheralInterval(peripheralId) {
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
      logger.info(`[${peripheralId}] Clearing existing outbox interval...`);
      clearInterval(this._outboxIntervals[peripheralId]);
    }
    this._outboxIntervals[peripheralId] = setInterval(() => {
      this.sendOldestPeripheralMessage(peripheralId);
    }, _.get(config, `engine.outbox.flush_interval`, 500));
  }

  initPeripheralIntervals() {
    this._outboxMessageMap = {};
    this._outboxIntervals = {};
    for (const peripheralId of this.peripheralIds) {
      logger.info(
        `Intializing outbox intervals for peripheral ${peripheralId}`
      );
      this.initPeripheralInterval(peripheralId);
    }
  }

  initInitialPeripheralSyncTimeout() {
    this._initialPeripheralSyncTimeout = {};
  }

  get connectionManager() {
    return this._connectionManager;
  }

  sendCommand(peripheralId, commandName, payload) {
    if (!this._outboxMessageMap[peripheralId]) {
      this._outboxMessageMap[peripheralId] = [];
    }
    this._outboxMessageMap[peripheralId].push(`<${commandName}>`);
    this._outboxMessageMap[peripheralId].push(
      `${payload}${_.get(config, `engine.outbox.delimiter`, `;`)}`
    );
  }

  sendData(peripheralId, payload) {
    this.sendCommand(peripheralId, `data`, payload);
  }

  sendSetting(peripheralId, settingStr) {
    this.sendCommand(peripheralId, `setting`, settingStr);
  }

  sendPeripheralSettings(peripheralId) {
    // Send lock MAC intialization settings
    if (peripheralId === this.lockMAC) {
      if (_.isNil(this._outboxMessageMap[this.lockMAC])) {
        // Clear all the outbox messages
        this._outboxMessageMap[this.lockMAC] = [];
      }

      // Send all the settings.
      logger.info(`Sending settings....`);
      const mainServoSettings = _.get(config, `lock.settings.main_servo`);
      const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
      const adxlSettings = _.get(config, `lock.settings.adxl`);

      this.sendSetting(
        this.lockMAC,
        `m_unlk=${mainServoSettings.frequencies.unlock}`
      );
      this.sendSetting(
        this.lockMAC,
        `m_lk=${mainServoSettings.frequencies.lock}`
      );
      this.sendSetting(
        this.lockMAC,
        `m_idle=${mainServoSettings.frequencies.idle}`
      );
      this.sendSetting(
        this.lockMAC,
        `l_en=${linearServoSettings.angles.engaged}`
      );
      this.sendSetting(
        this.lockMAC,
        `l_disen=${linearServoSettings.angles.disengaged}`
      );
      this.sendSetting(this.lockMAC, `l_step=${linearServoSettings.step}`);
      this.sendSetting(
        this.lockMAC,
        `adxl_rdcnt=${adxlSettings.max_read_count}`
      );
      this.sendSetting(this.lockMAC, `adxl_lk=${adxlSettings.angles.locked}`);
      this.sendSetting(
        this.lockMAC,
        `adxl_unlk=${adxlSettings.angles.unlocked}`
      );
    }
  }

  async onPeripheralSubscribed(peripheralId) {
    super.onPeripheralSubscribed(peripheralId);

    const characteristic =
      this.connectionManager.getPeripheralCharacteristics(peripheralId);
    logger.info(`Peripheral ${peripheralId} subscribed.`);
    if (_.isNil(characteristic)) {
      return;
    }
    if (this._initialPeripheralSyncTimeout[peripheralId]) {
      clearTimeout(this._initialPeripheralSyncTimeout[peripheralId]);
    }
    this._initialPeripheralSyncTimeout[peripheralId] = setTimeout(() => {
      this.sendPeripheralSettings(peripheralId);
    }, _.get(config, `lock.timeout`));
  }

  async onPeripheralDisconnected(peripheralId) {
    super.onPeripheralDisconnected(peripheralId);

    if (this._initialPeripheralSyncTimeout[peripheralId]) {
      clearTimeout(this._initialPeripheralSyncTimeout[peripheralId]);
    }
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
      logger.info(`[${peripheralId}] Clearing existing outbox interval...`);
      clearInterval(this._outboxIntervals[peripheralId]);
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
