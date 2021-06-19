import _ from 'lodash';
import { PeripheralBuffer } from '../peripheral/peripheral_buffer';
import config from '../lib/config';
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
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      for (let i = 0; i < history.length; ++i) {
        const log = history[i];
        if (log.logged || !log.dataString.endsWith('\r\n')) {
          continue;
        }
        const date = moment();
        this.redisClient.zadd(
          `log:${peripheralId}`,
          date.valueOf(),
          `[${date.toString()}] ${log.dataString}`
        );
        this.peripheralBuffer[peripheralId].dataStringHistory[i].logged = true;
      }
    }
    this.logFlushTimeout = setTimeout(async () => {
      this.logFlush();
    }, _.get(config, `logging.flush_interval_ms`, 500));
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
