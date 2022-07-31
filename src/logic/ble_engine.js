import _ from 'lodash';
import config from '../lib/config';
import logger from '../lib/logger';
import { SecretsLoader } from '../lib/secrets_loader';
import {
  PROCESS_STATE_FAILED,
  PROCESS_STATE_PROCESSED,
  PROCESS_STATE_PROCESSING,
  PROCESS_STATE_UNPROCESSED
} from '../peripheral/peripheral_buffer_history';
import { CardsLogic } from './cards';
import { ConnectionManager } from './connection_manager';
import { DataReceiver } from './data_receiver';
import { LockSettings, SETTINGS_METADATA } from './lock_settings';
import { Outbox } from './outbox';

export class BLEEngine extends DataReceiver {
  constructor() {
    super();

    this._connectionManager = null;

    this._initialPeripheralSyncTimeout = {};
    this.commandPromiseResolves = {};
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

  async toggleLock() {
    return new Promise((resolve) => {
      this.commandPromiseResolves['toggle_lock'] = resolve;
      const lockSecret = SecretsLoader.loadSecrets()['lockSecret'];
      this._outbox.sendMessage(this.lockMAC, `lock`, lockSecret);
      this._outbox.sendMessage(this.rfidMAC, `auth`);
    });
  }

  rebootLock() {
    this._outbox.sendMessage(this.lockMAC, `reboot`);
  }

  rebootRFID() {
    this._outbox.sendMessage(this.rfidMAC, `reboot`);
  }

  sendData(peripheralId, payload) {
    this._outbox.sendMessage(peripheralId, `data`, payload);
  }

  sendPeripheralSettings({
    peripheralId = this.lockMAC,
    settingName = '',
    settingValue = -1
  } = {}) {
    // Send lock MAC intialization settings
    if (peripheralId === this.lockMAC) {
      if (_.isEmpty(settingName)) {
        // Send all the settings.
        LockSettings.getInstance()
          .getSettingsMap()
          .then((settingsMap) => {
            logger.info(`[${this.lockMAC}] Sending settings....`);
            for (const setting of Object.values(settingsMap)) {
              this._outbox.sendMessage(
                this.lockMAC,
                setting.tag,
                `${setting.value}`
              );
            }
          });
      } else if (settingValue >= 0) {
        // A specific setting is requested. Take the value and try to save and send.
        LockSettings.getInstance().saveSetting({ settingName, settingValue });
        settingValue = `${settingValue}`;
        const settingTag = SETTINGS_METADATA[settingName].tag;
        this._outbox.sendMessage(this.lockMAC, settingTag, settingValue);
      }
    } else if (peripheralId === this.rfidMAC) {
      this._outbox.sendMessage(this.rfidMAC, `init`);
    }
  }

  async getLockSetting(tag) {
    return new Promise((resolve) => {
      this.commandPromiseResolves[tag] = resolve;
      // Send the request
      this._outbox.sendMessage(this.lockMAC, `get_${tag}`, ``);
    }).then((result) => {
      logger.info(`Retrieved result ${tag} - ${result}`);
      return result;
    });
  }

  async getAllLockSettings() {
    const tags = Object.values(SETTINGS_METADATA).map((setting) => setting.tag);
    const promises = [];
    for (const tag of tags) {
      // The order of promises resolutions will be according to tags,
      // which is based on the order of SETTINGS_METADATA.
      promises.push(this.getLockSetting(tag));
    }

    return Promise.all(promises).then((values) => {
      const result = {};
      const settingNames = Object.keys(SETTINGS_METADATA);
      for (let i = 0; i < values.length; ++i) {
        const settingName = settingNames[i];
        result[settingName] = values[i];
      }
      return result;
    });
  }

  async getLockStatus() {
    return new Promise((resolve) => {
      this.commandPromiseResolves['status'] = resolve;
      this._outbox.sendMessage(this.lockMAC, `status`);
    }).then((result) => {
      logger.info(`Retrieved lock status ${result}`);
      return result;
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
      this.sendPeripheralSettings({ peripheralId });
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
      const dataStringHistory =
        this.peripheralBuffer[this.rfidMAC].dataStringHistory;
      for (let i = 0; i < dataStringHistory.length; ++i) {
        if (dataStringHistory[i].processState === PROCESS_STATE_UNPROCESSED) {
          this.peripheralBuffer[this.rfidMAC].dataStringHistory[
            i
          ].processState = PROCESS_STATE_PROCESSING;
          const dataString = dataStringHistory[i].dataString;
          if (!dataString.endsWith('\r\n')) {
            // Incomplete history, skip
            this.peripheralBuffer[this.rfidMAC].dataStringHistory[
              i
            ].processState = PROCESS_STATE_UNPROCESSED;
            continue;
          }

          // e.g. <tag>value\r\n OR <tag>\r\n
          let tempDataString = dataString.replace('\r\n', '');

          // e.g. <tag>value OR <tag>
          const dataRegex = /^<[0-9a-zA-Z_]+>[0-9]*/g;
          const matches = tempDataString.match(dataRegex);
          if (!_.isNil(matches) && matches.length > 0) {
            let keyValueToken = tempDataString
              .replace('<', '') // remove first < character
              .split('>');
            logger.info(
              `[${peripheralId}] Received command/data ${keyValueToken}`
            );
            if (keyValueToken.length < 1) {
              this.peripheralBuffer[this.rfidMAC].dataStringHistory[
                i
              ].processState = PROCESS_STATE_FAILED;
              continue;
            }
            let tag = keyValueToken[0];
            switch (tag) {
              case 'req_rfid_data': {
                logger.info(
                  `[${peripheralId}] RFID requesting data, nothing to send.`
                );
                break;
              }
              case 'mfrc_ver': {
                logger.info(`RFID version found - 0x${keyValueToken[1]}`);
                break;
              }
              case 'mfrc_failed': {
                logger.warn(
                  `[${this.rfidMAC}] MFRC (RFID) module failed to communicate. Resetting RFID module`
                );
                this.rebootRFID();
                break;
              }
              case 'key': {
                const lockCharacteristic =
                  this.connectionManager.connectionStatuses[this.lockMAC]
                    .characteristic;
                if (!lockCharacteristic) {
                  logger.info(
                    `Door lock not connected yet, aborting data sending.`
                  );
                  this.peripheralBuffer[this.rfidMAC].dataStringHistory[
                    i
                  ].processState = PROCESS_STATE_FAILED;
                  return;
                }
                if (keyValueToken.length !== 2) {
                  this.peripheralBuffer[this.rfidMAC].dataStringHistory[
                    i
                  ].processState = PROCESS_STATE_FAILED;
                  continue;
                }
                let keyValue = keyValueToken[1].toLowerCase();
                const validKeys = await CardsLogic.getInstance().getKeys();
                let verified = false;
                for (const key of validKeys) {
                  if (keyValue === key) {
                    verified = true;
                    break;
                  }
                }
                logger.info(
                  `${
                    verified
                      ? 'Authorized! Sending lock toggle'
                      : 'Unauthorized'
                  }`
                );
                if (verified) {
                  await this.toggleLock();
                } else {
                  logger.warn(`Unauthorized key - ${keyValue}`);
                  this._outbox.sendMessage(this.rfidMAC, `unauth`);
                }
                break;
              }
            }
          }
          this.peripheralBuffer[this.rfidMAC].dataStringHistory[
            i
          ].processState = PROCESS_STATE_PROCESSED;
        }
      }
    } else if (peripheralId === this.lockMAC) {
      const dataStringHistory =
        this.peripheralBuffer[this.lockMAC].dataStringHistory;
      for (let i = 0; i < dataStringHistory.length; ++i) {
        if (dataStringHistory[i].processState === PROCESS_STATE_UNPROCESSED) {
          this.peripheralBuffer[this.lockMAC].dataStringHistory[
            i
          ].processState = PROCESS_STATE_PROCESSING;
          const dataString = dataStringHistory[i].dataString;
          if (!dataString.endsWith('\r\n')) {
            // Incomplete history, skip
            this.peripheralBuffer[this.lockMAC].dataStringHistory[
              i
            ].processState = PROCESS_STATE_UNPROCESSED;
            continue;
          }

          // e.g. <tag>value\r\n OR <tag>\r\n
          let tempDataString = dataString.replace('\r\n', '');

          // e.g. <tag>value OR <tag>
          const dataRegex = /^<[0-9a-zA-Z_]+>[0-9]*/g;
          const matches = tempDataString.match(dataRegex);
          if (!_.isNil(matches) && matches.length > 0) {
            let keyValueToken = tempDataString
              .replace('<', '') // remove first < character
              .split('>');
            logger.info(
              `[${peripheralId}] Received command/data ${keyValueToken}`
            );
            if (keyValueToken.length < 1) {
              this.peripheralBuffer[this.lockMAC].dataStringHistory[
                i
              ].processState = PROCESS_STATE_FAILED;
              continue;
            }
            let tag = keyValueToken[0];
            switch (tag) {
              case 'req_lock_data': {
                logger.info(
                  `[${peripheralId}] Lock is requesting initial settings data, sending now.`
                );
                this.sendPeripheralSettings();
                break;
              }
              case 'status': {
                if (keyValueToken.length !== 2) {
                  this.peripheralBuffer[this.lockMAC].dataStringHistory[
                    i
                  ].processState = PROCESS_STATE_FAILED;
                  continue;
                }
                let lockStatus = parseInt(keyValueToken[1]);
                if (this.commandPromiseResolves['toggle_lock']) {
                  logger.info(
                    `Resolving toggle lock command result - ${lockStatus}`
                  );
                  this.commandPromiseResolves['toggle_lock'](lockStatus);
                  this.commandPromiseResolves['toggle_lock'] = null;
                }
                if (this.commandPromiseResolves['status']) {
                  logger.info(
                    `Resolving status command result - ${lockStatus}`
                  );
                  this.commandPromiseResolves['status'](lockStatus);
                  this.commandPromiseResolves['status'] = null;
                }
                break;
              }
              default: {
                // lock is trying to send back the requested setting value. e.g. <m_xlk>1800\r\n
                if (keyValueToken.length !== 2) {
                  this.peripheralBuffer[this.lockMAC].dataStringHistory[
                    i
                  ].processState = PROCESS_STATE_FAILED;
                  continue;
                }
                let settingValue = parseInt(keyValueToken[1]);
                if (!this.commandPromiseResolves[tag]) {
                  break;
                }
                this.commandPromiseResolves[tag](settingValue);
                this.commandPromiseResolves[tag] = null;
                break;
              }
            }
          } else {
            // Not a command
          }
          this.peripheralBuffer[this.lockMAC].dataStringHistory[
            i
          ].processState = PROCESS_STATE_PROCESSED;
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
