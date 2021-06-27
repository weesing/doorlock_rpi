import express from 'express';

export let router = express.Router();

router.get('/', (req, res, next) => {
  res.jsonp({
    message: "There's nothing here."
  });
});
