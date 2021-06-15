import express from 'express';
import { StaticGlobals } from '../../lib/static_globals';

export let router = express.Router();

router.post('/init', function (req, res, next) {
  console.log(require('util').inspect(req, { depth: 10 }));
  const body = req.body;
  const peripheralId = body.peripheralId;
  if (peripheralId) {
    StaticGlobals.getInstance()
      .getVar('ble_engine')
      .sendInitialPeripheralSync(peripheralId);
  }
  res.jsonp({
    message: 'Initialization triggered'
  });
});
