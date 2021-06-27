import IORedis from 'ioredis';
import _ from 'lodash';
import config from '../lib/config';
import logger from '../lib/logger';

export const SETTINGS_METADATA = {
  mainServoUnlockFrequency: {
    config: `lock.settings.main_servo.frequencies.unlock`,
    tag: `m_xlk`
  },
  mainServoLockFrequency: {
    config: `lock.settings.main_servo.frequencies.lock`,
    tag: `m_lk`
  },
  mainServoIdleFrequency: {
    config: `lock.settings.main_servo.frequencies.idle`,
    tag: `m_idl`
  },
  mainServoEndDelay: {
    config: `lock.settings.main_servo.end_delay`,
    tag: `m_edel`
  },
  linearServoEngagedAngle: {
    config: `lock.settings.linear_servo.angles.engaged`,
    tag: `l_en`
  },
  linearServoDisengagedAngle: {
    config: `lock.settings.linear_servo.angles.disengaged`,
    tag: `l_xen`
  },
  linearServoStep: {
    config: `lock.settings.linear_servo.step`,
    tag: `l_step`
  },
  linearServoMs: {
    config: `lock.settings.linear_servo.ms`,
    tag: `l_ms`
  },
  linearServoEndDelay: {
    config: `lock.settings.linear_servo.end_delay`,
    tag: `l_edel`
  },
  adxlReadSampleCount: {
    config: `lock.settings.adxl.max_read_count`,
    tag: `a_rdct`
  },
  adxlLockAngle: {
    config: `lock.settings.adxl.angles.locked`,
    tag: `a_lk`
  },
  adxlUnlockAngle: {
    config: `lock.settings.adxl.angles.unlocked`,
    tag: `a_xlk`
  },
  oledDebugDisplay: {
    config: `lock.settings.oled.debug_display`,
    tag: `o_dbg`
  }
};

export class LockSettings {
  constructor() {
    this._redisClient = new IORedis();
  }

  static getInstance() {
    if (!this._instance) {
      this._instance = new LockSettings();
    }
    return this._instance;
  }

  /**
   * Attempt to retrieve setting from data store. If does not exist, read from default config,
   * and populate back to data store.
   * @param {string} settingName
   * @returns value of setting
   */
  async getSettingValue(settingName) {
    let settingValue = await this._redisClient.get(`settings:${settingName}`);
    if (!settingValue) {
      // read from config and populate back to redis
      logger.warn(
        `Setting ${settingName} cannot be found. Populating from configuration.`
      );
      const configPath = SETTINGS_METADATA[settingName].config;
      settingValue = _.get(config, configPath);
      logger.info(
        `Setting ${settingName} default retrieved from config - ${settingValue}`
      );
      if (settingValue) {
        await this.saveSetting({ settingName, settingValue });
      }
    }
    return settingValue;
  }

  async getSettingsMap() {
    const settingsMap = Object.assign({}, SETTINGS_METADATA);
    for (const settingName of Object.keys(settingsMap)) {
      settingsMap[settingName].value = await this.getSettingValue(settingName);
    }
    logger.trace(settingsMap);
    logger.trace(`Settings map retrieved`);
    return settingsMap;
  }

  async saveSetting({ settingName, settingValue }) {
    logger.info(`Populating ${settingName} back to data store.`);
    return await this._redisClient.set(`settings:${settingName}`, settingValue);
  }
}
