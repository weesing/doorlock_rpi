import { SecretsLoader } from './secrets_loader';

export function isValidRequest(req, res, next) {
  const reqApiKey = req.headers[`api_key`];
  const apiKey = SecretsLoader.loadSecrets()['apiKey'];
  if (!reqApiKey || !apiKey || reqApiKey !== apiKey) {
    res.status(401);
    res.send();
    return;
  }

  next();
}
