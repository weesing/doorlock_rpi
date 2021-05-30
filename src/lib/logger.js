import pino from 'pino';

const logger = pino({
  level: 'trace',
  prettyPrint: true
});

export default logger;