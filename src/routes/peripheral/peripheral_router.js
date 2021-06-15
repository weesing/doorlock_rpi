import express from 'express';
import { StaticGlobals } from '../../lib/static_globals';

export let router = express.Router();

router.post('/init', function (req, res, next) {
  const body = req.body;
  const peripheralId = body.peripheralId.toLowerCase();
  if (peripheralId) {
    StaticGlobals.getInstance()
      .getVar('ble_engine')
      .sendInitialPeripheralSync(peripheralId);
  }
  res.jsonp({
    message: 'Initialization triggered'
  });
});
