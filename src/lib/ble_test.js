import { BLELib } from './ble';
import { SecretsLoader } from './secrets_loader';
import { PeripheralStatus } from '../peripheral/peripheral_status';

export class BLELibTest extends BLELib {
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

    if (peripheral.id === this.testMAC) {
      this.peripheralStatuses[peripheral.id].appendBuffer(data);
      const buffer = this.peripheralStatuses[peripheral.id].buffer;
      logger.info(`Peripheral buffer from ${peripheral.id} ${buffer}`);

      switch (peripheral.id) {
        case this.testMAC: {
          break;
        }
      }
    }
  }

  async loop() {
    switch (this.state) {
      case APP_STATE_IDLE: {
        const testStatus = this.peripheralStatuses[this.testMAC];
        if (testStatus) {
          // Test code.
          const needReinit =
            testStatus.status === PERIPHERAL_STATE_DISCONNECTED;
          if (needReinit) {
            logger.info(`Test status: ${testStatus.status}`);
            logger.info(
              `Detected disconnection, resetting all connections on next loop.`
            );
            this.state = APP_STATE_INIT;
          }
        }
        break;
      }
    }

    super.loop();
  }

  static getInstance() {
    if (BLELibTest._instance === undefined) {
      BLELibTest._instance = new BLELibTest();
    }
    return BLELibTest._instance;
  }
}
