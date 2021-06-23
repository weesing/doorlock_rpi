import express from 'express';
import { StaticGlobals } from '../lib/static_globals';

export let router = express.Router();

router.post('/', async (req, res, next) => {
  StaticGlobals.getInstance().getVar('ble_engine').toggleLock();
  res.status(202);
  res.send();
});

router.get('/settings', async (req, res, next) => {
  const settings = await StaticGlobals.getInstance()
    .getVar('ble_engine')
    .getAllLockSettings();
  res.jsonp({ result: settings });
});

router.post('/settings', (req, res, next) => {
  StaticGlobals.getInstance()
    .getVar('ble_engine')
    .sendPeripheralSettings();
  res.jsonp({
    message: 'Lock settings sent'
  });
});
