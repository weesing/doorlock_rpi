import express from 'express';
import { StaticGlobals } from '../../lib/static_globals';
import { CardsLogic } from '../logic/cards';

export let router = express.Router();

router.get('/', async (req, res, next) => {
  res.jsonp({
    message: 'WIP'
  });
});

router.post('/', async (req, res, next) => {
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    await CardsLogic.getInstance().addKey(cardId);
  }
  res.jsonp({
    message: `Card ID ${cardId} added`
  });
});

router.delete('/', async (req, res, next) => {
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    // TODO: Delete card ID
  }
  res.jsonp({
    message: `Card ID ${cardId} deleted`
  });
});
