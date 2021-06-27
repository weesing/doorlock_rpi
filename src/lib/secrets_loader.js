import path from 'path';

export class SecretsLoader {
  static loadSecrets() {
    let secretsPath = path.join(__dirname, "../../secrets/secrets.json");
    secretsPath = path.resolve(secretsPath);
    let secretsJSON = require(secretsPath);
    return secretsJSON;
  }
}