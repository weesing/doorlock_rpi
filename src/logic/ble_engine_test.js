import _ from 'lodash';
import { BLEEngine } from './ble_engine';
import { SecretsLoader } from '../lib/secrets_loader';
import logger from '../lib/logger';
import config from '../lib/config';

export class BLEEngineTest extends BLEEngine {
  constructor() {
    super();
  }

  initPeripheralIds() {
    super.initPeripheralIds();

    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);
    // Overwrite lockMAC
    this.lockMAC = secrets.testMAC.toLowerCase();

    // Only require lock to test
    this.peripheralIds = [this.lockMAC];
  }
}
