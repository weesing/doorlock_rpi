import express from 'express';
import { StaticGlobals } from '../lib/static_globals';

export let router = express.Router();

router.post('/', async (req, res, next) => {
  StaticGlobals.getInstance().getVar('ble_engine').toggleLock();
  res.status(202);
  res.send();
});
