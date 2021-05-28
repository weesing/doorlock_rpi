import boot from './src/boot/boot';
import logger from './src/lib/logger';
const testMode = process.argv[2] === 'testmode';
logger.info(`Test mode: ${testMode}`);
boot(testMode);
