import path from 'path';

export class SecretsLoader {
  static loadSecrets() {
    let secretsPath = path.join(__dirname, "../../secrets/secrets.json");
    secretsPath = path.resolve(secretsPath);
    console.log(secretsPath);
    let secretsJSON = require(secretsPath);
    return secretsJSON;
  }
}