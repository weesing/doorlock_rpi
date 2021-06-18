import { SecretsLoader } from './secrets_loader';

export function isValidRequest(req, res, next) {
  const reqApiKey = req.headers[`api_key`];
  if (!reqApiKey) {
    res.status(401);
    res.send();
    return;
  }
  const apiKey = SecretsLoader.loadSecrets()['apiKey'];
  if (reqApiKey !== apiKey) {
    res.status(401);
    res.send();
    return;
  }

console.log('authorized');
  next();
}
