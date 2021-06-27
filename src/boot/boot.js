import { BLEEngineTest } from '../logic/ble_engine_test';
import { BLEEngine } from '../logic/ble_engine';
import config from '../lib/config';
import logger from '../lib/logger';
import { StaticGlobals } from '../lib/static_globals';

var boot = async function (testMode = false) {
  logger.info(`Configuration loaded`);
  logger.info(config);

  let engineInstance = null;
  if (testMode) {
    logger.warn(`Running in test mode.`);
    engineInstance = BLEEngineTest.getInstance();
  } else {
    engineInstance = BLEEngine.getInstance();
  }
  StaticGlobals.getInstance().setVar('ble_engine', engineInstance);
  engineInstance.initBLE();
};

export default boot;
