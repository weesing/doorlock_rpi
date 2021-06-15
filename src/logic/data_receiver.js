import _ from 'lodash';
import { PeripheralBuffer } from '../peripheral/peripheral_buffer';
import logger from '../lib/logger';

export class DataReceiver {
  constructor() {
    // initialize all the peripheral MAC addresses.
    this.initPeripheralIds();

    this.initPeripheralIntervals();

    // initialize the buffers
    this.initBuffer(this.peripheralIds);
  }

  initPeripheralIds() {
    // To be implemented by child classes.
    this.peripheralIds = [];

    return;
  }

  initPeripheralInterval(peripheralId) {
console.log(this._outboxIntervals);
console.log(!_.isNil(this._outboxIntervals[peripheralId]));
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
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

  async onPeripheralSubscribed(peripheralId) {
    // Implemented by child classes.
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
