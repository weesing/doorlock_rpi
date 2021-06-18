import _ from 'lodash';
import { PeripheralBuffer } from '../peripheral/peripheral_buffer';
import logger from '../lib/logger';
import IORedis from 'ioredis';
import moment from 'moment';

export class DataReceiver {
  constructor() {
    // initialize all the peripheral MAC addresses.
    this.initPeripheralIds();

    // initialize the buffers
    this.initBuffer(this.peripheralIds);

    this.redisClient = new IORedis();
  }

  initPeripheralIds() {
    // To be implemented by child classes.
    this.peripheralIds = [];

    return;
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

  async onPeripheralSubscribed(peripheralId) {}

  async onPeripheralConnected(peripheralId) {}

  async onPeripheralDisconnected(peripheralId) {}

  async onDataReceived(peripheral, bufferData, isNotification) {
    const peripheralId = peripheral.id;
    if (this.peripheralBuffer[peripheralId]) {
      this.peripheralBuffer[peripheralId].appendBuffer(bufferData);
      const buffer = this.peripheralBuffer[peripheralId].buffer;
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      for(let i = 0; i < history.length; ++i) {
        const log = history[i];
        if (log.sent) {
          continue;
        }
        const dateString = moment().format(`YYYY-MM-DD hh:mm:ss`);
        const logString = log.dataString;
        if (log.dataString.endsWith('\r\n')) {
          this.redisClient.sadd(
            `log:${peripheralId}`,
            `[${dateString}] ${logString}`
          );
          this.peripheralBuffer[peripheralId].dataStringHistory[i].sent = true;
        }
      }
    } else {
      logger.warn(`[${peripheralId}] Received data from unknown device.`);
    }
  }

  getPeripheralHistory(peripheralId) {
    const buffer = this.peripheralBuffer[peripheralId];
    if (!buffer) {
      return [];
    }
    return buffer.dataStringHistory;
  }
}
