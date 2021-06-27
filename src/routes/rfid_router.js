import express from 'express';
import { StaticGlobals } from '../lib/static_globals';

export let router = express.Router();

router.post('/reboot', (req, res, next) => {
  StaticGlobals.getInstance().getVar('ble_engine').rebootRFID();
  res.jsonp({
    message: 'reboot'
  });
});
