import express from 'express';

export let router = express.Router();

router.post('/:peripiheralId/init', function (req, res, next) {
  console.log(req);
  res.jsonp({
    message: 'Initialization triggered'
  });
});
