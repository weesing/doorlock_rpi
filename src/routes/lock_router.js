import express from 'express';
import { StaticGlobals } from '../lib/static_globals';

export let router = express.Router();

router.post('/', async (req, res, next) => {
  const lockStatus = await StaticGlobals.getInstance()
    .getVar('ble_engine')
    .toggleLock();

  res.jsonp({
    status: lockStatus ? 'locked' : 'unlocked'
  });
});

router.get('/status', async (req, res, next) => {
  const lockStatus = await StaticGlobals.getInstance()
    .getVar('ble_engine')
    .getLockStatus();

  res.jsonp({
    status: lockStatus ? 'locked' : 'unlocked'
  });
});

router.get('/settings', async (req, res, next) => {
  const settings = await StaticGlobals.getInstance()
    .getVar('ble_engine')
    .getAllLockSettings();
  res.jsonp({ result: settings });
});

router.post('/settings', (req, res, next) => {
  const body = req.body;
  const settingName = body.settingName;
  const settingValue = body.settingValue;
  StaticGlobals.getInstance()
    .getVar('ble_engine')
    .sendPeripheralSettings({ settingName, settingValue });
  res.jsonp({
    message: 'Lock settings sent'
  });
});

router.post('/reboot', (req, res, next) => {
  StaticGlobals.getInstance().getVar('ble_engine').rebootLock();
  res.jsonp({
    message: 'reboot'
  });
});
