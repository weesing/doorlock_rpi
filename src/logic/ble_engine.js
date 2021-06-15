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

  async onPeripheralSubscribed(peripheralId) {
    super.onPeripheralSubscribed(peripheralId);
    const characteristic =
      this.connectionManager.getPeripheralCharacteristics(peripheralId);
    if (_.isNil(characteristic)) {
      return;
    }

    switch (peripheralId) {
      case this.lockMAC: {
        // Send all the settings.
        const mainServoSettings = _.get(config, `lock.settings.main_servo`);
        const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
        const adxlSettings = _.get(config, `lock.settings.adxl`);

        const delimiter = `\r\n`;
        let sendData = `m_unlk=${mainServoSettings.frequencies.unlock}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `m_lk=${mainServoSettings.frequencies.lock}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `m_idle=${mainServoSettings.frequencies.idle}${delimiter}`;
        characteristic.write(Buffer.from(sendData));

        sendData = `l_en=${linearServoSettings.angles.engaged}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `l_disen=${linearServoSettings.angles.disengaged}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `l_step=${linearServoSettings.step}${delimiter}`;
        characteristic.write(Buffer.from(sendData));

        sendData = `adxl_rdcnt=${adxlSettings.max_read_count}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `adxl_lk=${adxlSettings.angles.locked}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `adxl_unlk=${adxlSettings.angles.unlocked}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        break;
      }
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
