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

    this.initLogFlushInterval();
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

  logFlush() {
    for (const peripheralId of Object.keys(this.peripheralBuffer)) {
      logger.info(`[${peripheralId}] Flushing logs for peripheral`);
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      for (const log of history) {
        if (log.sent) {
          continue;
        }
        const dateString = moment().format(`YYYY-MM-DD hh:mm:ss`);
        this.redisClient.sadd(
          `log:${peripheralId}`,
          `[${dateString}] ${log.dataString}`
        );
        log.sent = true;
      }
    }
    this.logFlushTimeout = setTimeout(async () => {
      this.logFlush();
    }, 1000);
  }

  initLogFlushInterval() {
    this.logFlush();
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
