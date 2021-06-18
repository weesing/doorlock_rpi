import express from 'express';
import { isValidRequest } from '../lib/auth';
import { CardsLogic } from '../logic/cards';

export let router = express.Router();

router.get('/', async (req, res, next) => {
  const isValid = isValidRequest(req);
  if (!isValid) {
    res.status(401);
    res.send();
    return;
  }
  const keys = await CardsLogic.getInstance().getKeys();
  res.jsonp({ keys });
});

router.post('/', async (req, res, next) => {
  const isValid = isValidRequest(req);
  if (!isValid) {
    res.status(401);
    res.send();
    return;
  }
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    await CardsLogic.getInstance().addKey(cardId);
  }
  res.status(202);
  res.send();
});

router.delete('/', async (req, res, next) => {
  const isValid = isValidRequest(req);
  if (!isValid) {
    res.status(401);
    res.send();
    return;
  }
  const body = req.body;
  const cardId = body.cardId.toLowerCase();
  if (cardId) {
    await CardsLogic.getInstance().removeKey(cardId);
  }
  res.status(202);
  res.send();
});
