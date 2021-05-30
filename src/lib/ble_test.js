import { BLEEngine } from './ble_engine';
import { SecretsLoader } from './secrets_loader';
import logger from './logger';
import {
  PERIPHERAL_STATE_DISCONNECTED,
  PeripheralStatus
} from '../peripheral/peripheral_status';
import { APP_STATE_INIT, APP_STATE_IDLE } from './app_state';

export class BLELibTest extends BLEEngine {
  constructor() {
    super();

    const secrets = SecretsLoader.loadSecrets();

    this.testMAC = secrets.testMAC.toLowerCase();
    this.connectionTargetMACs = [this.testMAC];

    this.peripheralStatuses = {
      [this.testMAC]: new PeripheralStatus()
    };
  }

  async onDataReceived(peripheral, data, isNotification) {
    super.onDataReceived(peripheral, data, isNotification);
console.log(peripheral.id + ' VS ' + this.testMAC);
    if (peripheral.id === this.testMAC) {
      this.peripheralStatuses[peripheral.id].appendBuffer(data);
      const buffer = this.peripheralStatuses[peripheral.id].buffer;
      const history = this.peripheralStatuses[peripheral.id].dataStringHistory;
      logger.info(`[${peripheral.id}] Peripheral buffer - '${buffer}'`);
      logger.info(`[${peripheral.id}] Peripheral history - ${history}`);

      switch (peripheral.id) {
        case this.testMAC: {
          break;
        }
      }
    }
  }
}
