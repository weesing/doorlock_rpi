import { PeripheralBuffer } from '../peripheral/peripheral_buffer';
import logger from '../lib/logger';

export class DataReceiver {
  initBuffer(peripheralIds) {
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

  async onDataReceived(peripheral, data, isNotification) {
    const peripheralId = peripheral.id;
    if (this.peripheralBuffer[peripheralId]) {
      this.peripheralBuffer[peripheralId].appendBuffer(data);
      const buffer = this.peripheralBuffer[peripheralId].buffer;
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      logger.info(`[${peripheralId}] Peripheral buffer '${buffer}'`);
      logger.info(`[${peripheralId}] Peripheral history ${history}`);
    } else {
      logger.warn(`[${peripheralId}] Received data from unknown device.`);
    }
  }
}
