import { BLEEngineTest } from '../logic/ble_engine_test';
import { BLEEngine } from '../logic/ble_engine';
import config from '../lib/config';
import logger from '../lib/logger';

let g_EngineInstance;

var boot = async function (testMode = false) {
  logger.info(`Configuration loaded`);
  logger.info(config);

  if (testMode) {
    logger.warn(`Running in test mode.`);
    g_EngineInstance = BLEEngineTest.getInstance();
  } else {
    g_EngineInstance = BLEEngine.getInstance();
  }
  g_EngineInstance.initBLE();
};

export default boot;
