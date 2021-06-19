import _ from 'lodash';
import logger from '../lib/logger';

export class Outbox {
  constructor(peripheralIds, connectionManager) {
    this._outboxMessageMap = {};
    this._outboxIntervals = {};

    this._connectionManager = connectionManager;

    for (const peripheralId of peripheralIds) {
      logger.info(
        `Intializing outbox intervals for peripheral ${peripheralId}`
      );
      this.createInterval(peripheralId);
    }
  }

  get outboxMessageMap() {
    return this._outboxMessageMap;
  }

  get outboxIntervals() {
    return this._outboxIntervals;
  }

  createInterval(peripheralId) {
    if (!_.isNil(this._outboxIntervals[peripheralId])) {
      logger.info(`[${peripheralId}] Clearing existing outbox interval...`);
      clearInterval(this._outboxIntervals[peripheralId]);
    }
    this._outboxIntervals[peripheralId] = setInterval(() => {
      this.popPeripheralMessage(peripheralId);
    }, _.get(config, `engine.outbox.flush_interval`, 500));
  }

  sendMessage(peripheralId, tag, payload) {
    if (!this._outboxMessageMap[peripheralId]) {
      this._outboxMessageMap[peripheralId] = [];
    }
    const delimiter = _.get(config, `engine.outbox.delimiter`, `;`);
    this._outboxMessageMap[peripheralId].push(
      `<${tag}>${payload}${delimiter}`
    );
  }

  popPeripheralMessage(peripheralId) {
    // get characteristic for sending.
    const characteristic =
      this._connectionManager.getPeripheralCharacteristic(peripheralId);
    if (_.isNil(characteristic)) {
      return;
    }
    if (
      !_.isNil(this._outboxMessageMap[peripheralId]) &&
      this._outboxMessageMap[peripheralId].length > 0
    ) {
      // send oldest message
      const pending = this._outboxMessageMap[peripheralId].shift();
      logger.info(`[${peripheralId}] Sending ${pending} to ${peripheralId}`);
      try {
        characteristic.write(Buffer.from(pending));
      } catch (e) {
        // Error. Put back the message.
        this._outboxMessageMap[peripheralId].unshift(pending);
        logger.error(
          `[${peripheralId}] Error sending oldest message to peripheral`
        );
        logger.error(e);
      }
    }
  }
}
