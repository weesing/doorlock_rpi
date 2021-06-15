import _ from 'lodash';
import { PeripheralBuffer } from '../peripheral/peripheral_buffer';
import logger from '../lib/logger';

export class DataReceiver {
  constructor() {
    // initialize all the peripheral MAC addresses.
    this.initPeripheralIds();

    this.initPeripheralIntervals();

    this.initInitialPeripheralSyncTimeout();

    // initialize the buffers
    this.initBuffer(this.peripheralIds);
  }

  initPeripheralIds() {
    // To be implemented by child classes.
    this.peripheralIds = [];

    return;
  }

  initPeripheralInterval(peripheralId) {
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
      logger.info(`[${peripheralId}] Clearing existing outbox interval...`);
      clearInterval(this._outboxIntervals[peripheralId]);
    }
    this._outboxIntervals[peripheralId] = setInterval(() => {
      this.sendOldestPeripheralMessage(peripheralId);
    }, 500);
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

  initBuffer(peripheralIds = []) {
    // Create a data buffer object (PeripheralBuffer) for each peripheral
    this.peripheralBuffer = {};
    for (const peripheralId of peripheralIds) {
      if (peripheralId !== undefined) {
        this.peripheralBuffer[peripheralId] = new PeripheralBuffer();
      }
    }
  }

  clearBufferByPeripheral(peripheralId) {
    this.peripheralBuffer[peripheralId].clearBuffer();
  }

  async sendInitialPeripheralSync(peripheralId) {
    // Do nothing in base class.
  }

  async onPeripheralSubscribed(peripheralId) {
    const characteristic =
      this.connectionManager.getPeripheralCharacteristics(peripheralId);
    logger.info(`Peripheral ${peripheralId} subscribed.`);
    if (_.isNil(characteristic)) {
      return;
    }
    if (this._initialPeripheralSyncTimeout[peripheralId]) {
      clearTimeout(this._initialPeripheralSyncTimeout[peripheralId]);
    }
    this._initialPeripheralSyncTimeout[peripheralId] = setTimeout(async () => {
      await this.sendInitialPeripheralSync(peripheralId);
    });
  }

  async onPeripheralConnected(peripheralId) {}

  async onPeripheralDisconnected(peripheralId) {
    if (this._initialPeripheralSyncTimeout[peripheralId]) {
      clearTimeout(this._initialPeripheralSyncTimeout[peripheralId]);
    }
  }

  async onDataReceived(peripheral, data, isNotification) {
    const peripheralId = peripheral.id;
    if (this.peripheralBuffer[peripheralId]) {
      this.peripheralBuffer[peripheralId].appendBuffer(data);
      const buffer = this.peripheralBuffer[peripheralId].buffer;
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
    } else {
      logger.warn(`[${peripheralId}] Received data from unknown device.`);
    }
  }
}
