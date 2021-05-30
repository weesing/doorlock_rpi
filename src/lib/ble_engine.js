import _ from 'lodash';
import logger from './logger';
import { SecretsLoader } from './secrets_loader';
import { ConnectionManager } from './connection_manager';
import { PeripheralBuffer } from '../peripheral/peripheral_buffer';

export class BLEEngine {
  constructor() {
    this._connectionManager = null;

    // initialize all the peripheral MAC addresses.
    this.initPeripheralMACs();

    // initialize all peripheral buffers
    this.initBuffer();
  }

  get connectionTargetMACs() {
    return [this.rfidMAC, this.lockMAC];
  }

  get connectionManager() {
    return this._connectionManager;
  }

  initPeripheralMACs() {
    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);

    this.rfidMAC = secrets.rfidMAC.toLowerCase();
    this.lockMAC = secrets.lockMAC.toLowerCase();
    this.meMAC = secrets.nodeMAC.toLowerCase();
  }

  initBuffer() {
    this.peripheralBuffer = {};
    for (const deviceMAC of this.connectionTargetMACs) {
      if (deviceMAC !== undefined) {
        this.peripheralBuffer[deviceMAC] = new PeripheralBuffer();
      }
    }
  }

  clearBufferByPeripheral(peripheralId) {
    this.peripheralBuffer[peripheralId].clearBuffer();
  }

  async onDataReceived(peripheral, data, isNotification) {
    if (peripheral.id === this.rfidMAC || peripheral.id === this.lockMAC) {
      const peripheralId = peripheral.id;
      this.peripheralBuffer[peripheralId].appendBuffer(data);
      const buffer = this.peripheralBuffer[peripheralId].buffer;
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      logger.info(`[${peripheralId}] Peripheral buffer '${buffer}'`);
      logger.info(`[${peripheralId}] Peripheral history ${history}`);

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
          break;
        }
      }
    }
  }

  async initBLE() {
    logger.info(`Intitializing BLE...`);

    this._connectionManager = new ConnectionManager(this.connectionTargetMACs);
    this._connectionManager.startConnections(this);
  }

  static getInstance() {
    if (this._instance === undefined) {
      this._instance = new this();
    }
    return this._instance;
  }
}
