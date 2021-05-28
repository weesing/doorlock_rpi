import boot from './src/boot/boot';
const testMode = process.argv[0] === 'test_mode';
boot(testMode);
