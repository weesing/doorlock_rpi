import { BLELib } from '../lib/ble';
import { BLELibTest } from '../lib/ble_test';
import logger from '../lib/logger';

var boot = async function () {
  const config = require('../../config/config.json');
  if (config.test) {
    logger.info(`Running in test mode.`);
    await BLELibTest.getInstance().initBLE();
  } else {
    await BLELib.getInstance().initBLE();
  }
};

export default boot;
