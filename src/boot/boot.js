import { BLEEngineTest } from '../logic/ble_engine_test';
import { BLEEngine } from '../logic/ble_engine';
import config from '../lib/config';
import logger from '../lib/logger';

var boot = async function (testMode = false) {
  logger.info(`Configuration loaded`);
  logger.info(config);

  if (testMode) {
    logger.warn(`Running in test mode.`);
    await BLEEngineTest.getInstance().initBLE();
  } else {
    await BLEEngine.getInstance().initBLE();
  }
};

export default boot;
