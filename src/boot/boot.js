import { BLEEngineTest } from '../lib/ble_test';
import { BLEEngine } from '../lib/ble_engine';
import logger from '../lib/logger';

var boot = async function (testMode = false) {
  const config = require('../../config/config.json');

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
