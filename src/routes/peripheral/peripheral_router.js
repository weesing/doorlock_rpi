import express from 'express';

export let router = express.Router();

router.post('/init', function (req, res, next) {
  console.log(require('util').inspect(req, { depth: 10 }));
  res.jsonp({
    message: 'Initialization triggered'
  });
});
