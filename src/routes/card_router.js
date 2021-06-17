import express from 'express';
import { CardsLogic } from '../logic/cards';

export let router = express.Router();

router.get('/', async (req, res, next) => {
  const keys = await CardsLogic.getInstance().getKeys();
  res.jsonp({ keys });
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
    await CardsLogic.getInstance().removeKey(cardId);
  }
  res.jsonp({
    message: `Card ID ${cardId} deleted`
  });
});
