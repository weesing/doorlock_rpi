import { SecretsLoader } from "./secrets_loader";

export function isValidRequest(req) {
  const reqAuthSecret = req.body['auth'] || req.params['auth'];
  if (!reqAuthSecret) {
    return false;
  }
  const authSecret = SecretsLoader.loadSecrets()['auth'];
  return reqAuthSecret === authSecret;
}