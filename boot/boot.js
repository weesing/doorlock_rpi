import { BLELib } from '../src/lib/ble';
import { SecretsLoader } from '../src/lib/secrets_loader';

var boot = async function () {
	await BLELib.getInstance().initBLE();
	console.log('BLE initialized');
}

export default boot;