import _ from 'lodash';
import logger from './logger';
import { SecretsLoader } from './secrets_loader';
import { ConnectionManager } from './connection_manager';

export class BLEEngine {
  constructor() {
    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);

    this.rfidMAC = secrets.rfidMAC.toLowerCase();
    this.lockMAC = secrets.lockMAC.toLowerCase();
    this.meMAC = secrets.nodeMAC.toLowerCase();

    this.connectionManager = null;
  }

  async onDataReceived(peripheral, data, isNotification) {
    if (peripheral.id === this.rfidMAC || peripheral.id === this.lockMAC) {
      this.connectionManager.peripheralStatuses[peripheral.id].appendBuffer(
        data
      );
      const buffer =
        this.connectionManager.peripheralStatuses[peripheral.id].buffer;
      const history =
        this.connectionManager.peripheralStatuses[peripheral.id]
          .dataStringHistory;
      logger.info(`[${peripheral.id}] Peripheral buffer '${buffer}'`);
      logger.info(`[${peripheral.id}] Peripheral history ${history}`);

      switch (peripheral.id) {
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
          break;
        }
      }
    }
  }

  get dataReceiverClass() {
    return BLEEngine;
  }

  get connectionTargetMACs() {
    return [this.rfidMAC, this.lockMAC];
  }

  async initBLE() {
    logger.info(`Intitializing BLE...`);

    this.connectionManager = new ConnectionManager(this.connectionTargetMACs);
    this.connectionManager.startConnections(this.dataReceiverClass);
  }

  static getInstance() {
    if (this._instance === undefined) {
      this._instance = new this();
    }
    return this._instance;
  }
}
