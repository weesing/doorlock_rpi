import { SecretsLoader } from './secrets_loader';

export function isValidRequest(req) {
  const reqApiKey = req.headers[`api_key`];
  if (!reqApiKey) {
    return false;
  }
  const apiKey = SecretsLoader.loadSecrets()['apiKey'];
  return reqApiKey === apiKey;
}
