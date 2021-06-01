import _ from 'lodash';
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

  async onDataReceived(peripheral, data, isNotification) {
    super.onDataReceived(peripheral, data, isNotification);
    const peripheralId = peripheral.id;
    if (peripheralId === this.rfidMAC || peripheralId === this.lockMAC) {
      switch (peripheralId) {
        case this.rfidMAC: {
          const lockCharacteristic =
            this.connectionManager.peripheralStatuses[this.lockMAC]
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
