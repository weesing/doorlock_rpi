import { SecretsLoader } from "./secrets_loader";

export function isValidRequest(req) {
  const reqAuthSecret = req.body['auth'] || req.query['auth'];
  if (!reqAuthSecret) {
    return false;
  }
  const authSecret = SecretsLoader.loadSecrets()['auth'];
  return reqAuthSecret === authSecret;
}
