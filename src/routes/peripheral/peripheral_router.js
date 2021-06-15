import express from 'express';

export let router = express.Router();

router.post('/init', function (req, res, next) {
  console.log(require('util').inspect(req, { depth: 10 }));
  const body = req.body;
  const peripheralId = body.peripheralId;
  if (peripheralId) {
    g_EngineInstance.sendInitialPeripheralSync(peripheralId);
  }
  res.jsonp({
    message: 'Initialization triggered'
  });
});
