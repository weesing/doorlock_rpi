import express from 'express';
import { StaticGlobals } from '../../lib/static_globals';

export let router = express.Router();

router.get('/', (req, res, next) => {
  res.jsonp({
    message: 'WIP'
  });
});

router.post('/', (req, res, next) => {
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    //TODO: Add card ID
  }
  res.jsonp({
    message: `Card ID ${cardId} added`
  });
});

router.delete('/', (req, res, next) => {
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    // TODO: Delete card ID
  }
  res.jsonp({
    message: `Card ID ${cardId} deleted`
  });
});
