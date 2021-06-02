import { BLEEngine } from './ble_engine';
import { SecretsLoader } from '../lib/secrets_loader';
import logger from '../lib/logger';

export class BLEEngineTest extends BLEEngine {
  constructor() {
    super();
  }

  initPeripheralIds() {
    super.initPeripheralIds();

    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);
    this.testMAC = secrets.testMAC.toLowerCase();

    this.peripheralIds = [this.testMAC];
  }

  async onDataReceived(peripheral, data, isNotification) {
    super.onDataReceived(peripheral, data, isNotification);

    const peripheralId = peripheral.id;
    if (peripheralId === this.testMAC) {
      switch (peripheralId) {
        case this.testMAC: {
          // Do nothing.
          break;
        }
      }
    }
  }
}
