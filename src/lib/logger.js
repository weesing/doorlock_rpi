import pino from 'pino';
import config from './config';

const logger = pino({
  level: config['log_level'],
  prettyPrint: true
});

export default logger;
