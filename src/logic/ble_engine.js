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

  popPeripheralMessage(peripheralId) {
    // get characteristic for sending.
    const characteristic =
      this.connectionManager.getPeripheralCharacteristics(peripheralId);
    if (_.isNil(characteristic)) {
      return;
    }
    if (
      !_.isNil(this._outboxMessageMap[peripheralId]) &&
      this._outboxMessageMap[peripheralId].length > 0
    ) {
      // send oldest message
      const pending = this._outboxMessageMap[peripheralId].shift();
      logger.info(`[${peripheralId}] Sending ${pending} to ${peripheralId}`);
      try {
        characteristic.write(Buffer.from(pending));
      } catch (e) {
        // Error. Put back the message.
        this._outboxMessageMap[peripheralId].unshift(pending);
        logger.error(`[${peripheralId}] Error writing into characteristics`);
        logger.error(e);
      }
    } else if (this._outboxMessageMap[peripheralId].length === 0) {
      // No pending messages, send heartbeat
      try {
        characteristic.write(Buffer.from('<hb>;'));
      } catch (e) {
        logger.error(`[${peripheralId}] Error sending heartbeat`);
        logger.error(e);
      }
    }
  }

  initPeripheralInterval(peripheralId) {
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
      logger.info(`[${peripheralId}] Clearing existing outbox interval...`);
      clearInterval(this._outboxIntervals[peripheralId]);
    }
    this._outboxIntervals[peripheralId] = setInterval(() => {
      this.popPeripheralMessage(peripheralId);
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

  toggleLock() {
    const lockSecret = SecretsLoader.loadSecrets()['lockSecret'];
    this.sendCommand(this.lockMAC, `lock`, lockSecret);
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

      // TODO: Examine the data sent and forward to lock
      const testKey = Buffer.from('ffFFffFF', 'hex');
      if (Buffer.compare(bufferData, testKey) === 0) {
        logger.info(`Authorized! Sending data.`);
        this.toggleLock();
      } else {
        logger.warn(`Unauthorized!`);
      }
      // lockCharacteristic.write(data);
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
