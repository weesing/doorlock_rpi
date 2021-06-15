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
    this.testMAC = secrets.testMAC.toLowerCase();

    this.peripheralIds = [this.testMAC];
  }

  async onPeripheralSubscribed(peripheralId) {
    super.onPeripheralSubscribed(peripheralId);
    const characteristic =
      this.connectionManager.getPeripheralCharacteristics(peripheralId);
    if (_.isNil(characteristic)) {
      return;
    }

    switch (peripheralId) {
      case this.testMAC: {
        // Send all the settings.
        const mainServoSettings = _.get(config, `lock.settings.main_servo`);
        const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
        const adxlSettings = _.get(config, `lock.settings.adxl`);

        const delimiter = `\r\n`;
        let sendData = `m_unlk=${mainServoSettings.frequencies.unlock}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `m_lk=${mainServoSettings.frequencies.lock}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `m_idle=${mainServoSettings.frequencies.idle}${delimiter}`;
        characteristic.write(Buffer.from(sendData));

        sendData = `l_en=${linearServoSettings.angles.engaged}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `l_disen=${linearServoSettings.angles.disengaged}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `l_step=${linearServoSettings.step}${delimiter}`;
        characteristic.write(Buffer.from(sendData));

        sendData = `adxl_rdcnt=${adxlSettings.max_read_count}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `adxl_lk=${adxlSettings.angles.locked}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        sendData = `adxl_unlk=${adxlSettings.angles.unlocked}${delimiter}`;
        characteristic.write(Buffer.from(sendData));
        break;
      }
    }
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
