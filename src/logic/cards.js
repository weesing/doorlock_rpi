import IORedis from 'ioredis';

export class CardsLogic {
  constructor() {
    this.redisClient = new IORedis();
  }

  static getInstance() {
    if (!CardsLogic._instance) {
      CardsLogic._instance = new CardsLogic();
    }
    return CardsLogic._instance;
  }

  async addKey(newKey) {
    return await this.redisClient.sadd(`key_list`, newKey);
  }

  async getKeys() {
    return await this.redisClient.smembers(`key_list`);
  }

  async doesKeyExists(findKey) {
    const keys = await this.getKeys();
    for(const key of keys) {
      if (key === findKey) {
        return true;
      }
    }
    return false;
  }
}
