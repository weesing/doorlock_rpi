import _ from 'lodash';
import { BLEEngine } from './ble_engine';
import { SecretsLoader } from '../lib/secrets_loader';
import logger from '../lib/logger';
import config from '../lib/config';

export class BLEEngineTest extends BLEEngine {
  constructor() {
    super();

    this.outbox = [];
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
    logger.info(`Peripheral ${peripheralId} subscribed.`);
    if (_.isNil(characteristic)) {
      return;
    }

    switch (peripheralId) {
      case this.testMAC: {
        setTimeout(() => {
          // Send all the settings.
          logger.info(`Sending settings....`);
          const mainServoSettings = _.get(config, `lock.settings.main_servo`);
          const linearServoSettings = _.get(config, `lock.settings.linear_servo`);
          const adxlSettings = _.get(config, `lock.settings.adxl`);

          const delimiter = ';';
          this.outbox.push({peripheralId, message:`<settings>`});
          this.outbox.push({peripheralId, message:`m_unlk=${mainServoSettings.frequencies.unlock}${delimiter}`});
          this.outbox.push({peripheralId, message:`m_lk=${mainServoSettings.frequencies.lock}${delimiter}`});
          this.outbox.push({peripheralId, message:`m_idle=${mainServoSettings.frequencies.idle}${delimiter}`});

          this.outbox.push({peripheralId, message:`l_en=${linearServoSettings.angles.engaged}${delimiter}`});
          this.outbox.push({peripheralId, message:`l_disen=${linearServoSettings.angles.disengaged}${delimiter}`});
          this.outbox.push({peripheralId, message:`l_step=${linearServoSettings.step}${delimiter}`});

          this.outbox.push({peripheralId, message:`adxl_rdcnt=${adxlSettings.max_read_count}${delimiter}`});
          this.outbox.push({peripheralId, message:`adxl_lk=${adxlSettings.angles.locked}${delimiter}`});
          this.outbox.push({peripheralId, message:`adxl_unlk=${adxlSettings.angles.unlocked}${delimiter}`});

          this.outbox.push({peripheralId, message:`</settings>`});
        }, 2000);

        setInterval(() => {
          if (this.outbox.length > 0) {
            const pending = this.outbox.shift();
            const peripheralId = pending.peripheralId;
            const msg = pending.message;
            const characteristic = this.connectionManager.getPeripheralCharacteristics(peripheralId);
            if (_.isNil(characteristic)) {
              this.outbox.unshift(pending);
              return;
            }
            logger.info(`Sending ${msg} to ${peripheralId}`);
            characteristic.write(Buffer.from(msg));
          }
        }, 500);
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
