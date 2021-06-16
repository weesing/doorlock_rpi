import express from 'express';
import { StaticGlobals } from '../../lib/static_globals';

export let router = express.Router();

router.get('/settings', (req, res, next) => {
  res.jsonp({
    message: 'WIP'
  });
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

router.post('/data', (req, res, next) => {
  const body = req.body;
  const peripheralId = body.peripheralId.toLowerCase();
  const data = body.data;
  if (peripheralId) {
    StaticGlobals.getInstance()
      .getVar('ble_engine')
      .sendData(peripheralId, data);
  }
  res.jsonp({
    message: `Data ${data} sent to ${peripheralId}`
  });
});
