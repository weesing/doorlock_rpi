import { BLEEngine } from './ble_engine';
import { SecretsLoader } from './secrets_loader';
import logger from './logger';

export class BLEEngineTest extends BLEEngine {
  constructor() {
    super();
  }

  initPeripheralMACs() {
    super.initPeripheralMACs();
    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);
    this.testMAC = secrets.testMAC.toLowerCase();
  }

  get connectionTargetMACs() {
    return [this.testMAC];
  }

  async onDataReceived(peripheral, data, isNotification) {
    super.onDataReceived(peripheral, data, isNotification);
    if (peripheral.id === this.testMAC) {
      const peripheralId = peripheral.id;
      this.peripheralBuffer[peripheralId].appendBuffer(data);
      const buffer = this.peripheralBuffer[peripheralId].buffer;
      const history = this.peripheralBuffer[peripheralId].dataStringHistory;
      logger.info(`[${peripheralId}] Peripheral buffer - '${buffer}'`);
      logger.info(`[${peripheralId}] Peripheral history - ${history}`);

      switch (peripheralId) {
        case this.testMAC: {
          break;
        }
      }
    }
  }
}
