import { SecretsLoader } from "./secrets_loader";

export function isValidRequest(req) {
  const authorization = req.headers[`authorization`];
  if (!authorization) {
    return false;
  }
  const reqAuthSecret = authorization.split(' ')[1];
  if (!reqAuthSecret) {
    return false;
  }
  const authSecret = SecretsLoader.loadSecrets()['auth'];
  return reqAuthSecret === authSecret;
}
