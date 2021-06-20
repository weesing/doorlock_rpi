import express from 'express';
import { StaticGlobals } from '../lib/static_globals';

export let router = express.Router();

router.post('/', async (req, res, next) => {
  StaticGlobals.getInstance().getVar('ble_engine').toggleLock();
  res.status(202);
  res.send();
});

router.get('/settings', async (req, res, next) => {
  const result = await StaticGlobals.getInstance()
    .getVar('ble_engine')
    .getAllLockSettings();
  res.jsonp({ result });
});

router.post('/settings', (req, res, next) => {
  const body = req.body;
  const peripheralId = body.peripheralId.toLowerCase();
  if (peripheralId) {
    StaticGlobals.getInstance()
      .getVar('ble_engine')
      .sendPeripheralSettings(peripheralId);
  }
  res.jsonp({
    message: 'Initialization triggered'
  });
});
