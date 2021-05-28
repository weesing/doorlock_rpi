import util from 'util';
import _ from 'lodash';
import noble from 'noble';
import logger from './logger';
import { SecretsLoader } from './secrets_loader';
import {
  PERIPHERAL_STATE_DISCONNECTED,
  PERIPHERAL_STATE_CONNECTING,
  PERIPHERAL_STATE_CONNECTED,
  PeripheralStatus
} from '../peripheral/peripheral_status';

import {
  APP_STATE_INIT,
  APP_STATE_SCANNING,
  APP_STATE_INIT_NEXT_CONNECTION,
  APP_STATE_CONNECTING_DEVICE,
  APP_STATE_IDLE
} from './app_state';

const DISCOVER_DELAY = 0;

export class BLELib {
  constructor() {
    const secrets = SecretsLoader.loadSecrets();
    logger.info(secrets);

    this.rfidMAC = secrets.rfidMAC.toLowerCase();
    this.lockMAC = secrets.lockMAC.toLowerCase();
    this.connectionTargetMACs = [this.rfidMAC, this.lockMAC];

    this.meMAC = secrets.nodeMAC.toLowerCase();

    this.peripheralStatuses = {
      [this.rfidMAC]: new PeripheralStatus(),
      [this.lockMAC]: new PeripheralStatus()
    };
    this.discoveredPeripherals = {};
    this.connectedPeripherals = new Set();
    this.isScanning = false;
    this.state = APP_STATE_INIT;
    this.currentConnecting = null;

    this.onDiscoverCb = this.onDiscover.bind(this);
  }

  onDiscover(peripheral) {
    const targetSet = new Set(this.connectionTargetMACs);
    if (targetSet.has(peripheral.id.toLowerCase())) {
      logger.info(
        `>>>> Discovered peripheral ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 99, colors: true }
        )}, adding to pending connection list. <<<<`
      );

      this.discoveredPeripherals[peripheral.id.toLowerCase()] = peripheral;
    } else {
      logger.info(
        `Found unknown device ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 10 }
        )}`
      );
    }
  }

  async startScanning() {
    if (this.isScanning) {
      logger.info('Already scanning');
      return;
    }
    this.isScanning = true;

    // Re-register for discover event.
    noble.removeListener('discover', this.onDiscoverCb);
    noble.on('discover', this.onDiscoverCb);

    // Start the scanning.
    noble.startScanning([], false, function (error) {
      if (error) {
        logger.error(`Error on start scan.`);
        logger.error(util.inspect(error, { depth: 10, colors: true }));
        return;
      }
    });
  }

  async stopScanning() {
    noble.removeListener('discover', this.onDiscoverCb);
    noble.stopScanning();
    this.isScanning = false;
  }

  async onDataReceived(peripheral, data, isNotification) {
    if (peripheral.id === this.rfidMAC || peripheral.id === this.lockMAC) {
      this.peripheralStatuses[peripheral.id].appendBuffer(data);
      const buffer = this.peripheralStatuses[peripheral.id].buffer;
      logger.info(`Peripheral buffer from ${peripheral.id} ${buffer}`);

      switch (peripheral.id) {
        case this.rfidMAC: {
          const lockCharacteristic =
            this.peripheralStatuses[this.lockMAC].characteristic;
          if (!lockCharacteristic) {
            logger.info(`Door lock not connected yet, aborting data sending.`);
            return;
          }
          lockCharacteristic.write(data);
          break;
        }
        case this.lockMAC: {
          break;
        }
      }
    }
  }

  onPeripheralSubscribed(peripheral, characteristic) {
    this.connectedPeripherals.add(peripheral);
    this.peripheralStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_CONNECTED,
      peripheral,
      characteristic: characteristic
    });
    const buffer = Buffer.from(this.meMAC);
    characteristic.write(buffer);
    this.nextSubscriptionTimeout = null;
  }

  async discoverAndSubscribe(peripheral) {
    logger.info(
      `Connected peripheral ${peripheral.id}. Discovering services and characteristics...`
    );

    const dataReceivedCb = this.onDataReceived.bind(this);
    const subscribeSuccessfulCb = this.onPeripheralSubscribed.bind(this);
    peripheral.discoverSomeServicesAndCharacteristics(
      ['ffe0'],
      ['ffe1'],
      function (error, services, characteristics) {
        logger.info(
          `DISCOVERED SERVICES AND CHARACTERISTICS on ${peripheral.id}`
        );
        logger.info(
          util.inspect(
            {
              error,
              services: services.map((service) =>
                _.pick(service, ['_peripheralId', 'uuid'])
              ),
              characteristics: characteristics.map((char) =>
                _.pick(char, ['uuid', 'name', 'type', 'properties'])
              )
            },
            { depth: 10, colors: true }
          )
        );

        let characteristic = characteristics[0];
        logger.info(
          `Subscribing to characteristics ${characteristic.uuid} on peripheral ${peripheral.id}`
        );
        characteristic.on('data', (data, isNotification) => {
          logger.info(
            `<Received buffer> ${util.inspect(data, {
              depth: 10,
              colors: true
            })} (${data.toString()})`
          );
          dataReceivedCb(peripheral, data, isNotification);
        });
        characteristic.subscribe(function (error) {
          if (error) {
            logger.info(util.inspect(error, { depth: 10, colors: true }));
          } else {
            logger.info(
              `******* Subscribed to ${characteristic.uuid} on peripheral ${peripheral.id} ********`
            );
            subscribeSuccessfulCb(peripheral, characteristic);
          }
        });
      }
    );
  }

  async onPeripheralConnect(peripheral) {
    logger.info(`Peripheral ${peripheral.id} +++ CONNECTED +++`);

    if (this.nextSubscriptionTimeout) {
      logger.info(`>>>>>> Reconnection detected, cancelling timeout.`);
      clearTimeout(this.nextSubscriptionTimeout);
    }
    logger.info(
      `Queuing peripheral ${peripheral.id} for discovery and subscription.`
    );
    const discoverAndSubscribeFn = this.discoverAndSubscribe.bind(this);
    this.nextSubscriptionTimeout = setTimeout(async () => {
      await discoverAndSubscribeFn(peripheral);
    }, DISCOVER_DELAY);
  }

  async onPeripheralDisconnect(peripheral) {
    logger.info(`Peripheral ${peripheral.id} --- DISCONNECTED ---`);
    this.connectedPeripherals.delete(peripheral);
    if (this.peripheralStatuses[peripheral.id]) {
      // Attempt to reconnect
      logger.info(`Attempting to reconnect to ${peripheral.id}`);
      await this.connectPeripheral(peripheral);
    }
  }

  async connectPeripheral(peripheral) {
    this.stopScanning();
    // Attempt to connect to peripheral.
    // Set state of peripheral to connecting.
    this.peripheralStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_CONNECTING,
      peripheral
    });

    logger.info(`Initializing peripheral ${peripheral.id} events`);

    // Init callback for peripheral connected
    const onPeripheralConnect = this.onPeripheralConnect.bind(this);
    peripheral.once('connect', function () {
      onPeripheralConnect(peripheral);
    });

    // Init callback for peripheral disconnected
    const onPeripheralDisconnect = this.onPeripheralDisconnect.bind(this);
    peripheral.once('disconnect', function () {
      onPeripheralDisconnect(peripheral);
    });

    logger.info(`Peripheral events ${peripheral.id} initialized.`);

    logger.info(`Initiating connection to ${peripheral.id}`);
    // Initiate the connection after all the events have been registered above.
    peripheral.connect(function (error) {
      if (error) {
        logger.info(
          `Errors on connect to ${peripheral.id} - ${util.inspect(error, {
            depth: 99,
            colors: true
          })}`
        );
      }
    });
  }

  async disconnectPeripheral(peripheral) {
    logger.info(`Disconnecting ${peripheral.id}`);
    peripheral.disconnect();
    this.peripheralStatuses[peripheral.id].reset();
  }

  async disconnectAllDevices() {
    logger.info(`Disconnecting all devices`);
    for (const deviceId of Object.keys(this.peripheralStatuses)) {
      const pStatus = this.peripheralStatuses[deviceId];
      if (_.isNil(pStatus.peripheral)) {
        continue;
      }
      const peripheral = pStatus.peripheral;
      await this.disconnectPeripheral(peripheral);
    }
  }

  async loop() {
    switch (this.state) {
      case APP_STATE_INIT: {
        await this.disconnectAllDevices();
        // If peripheral wasn't there at all, start the scan.
        logger.info(`First time connection. Starting scan...`);
        await this.stopScanning();

        noble.once('scanStart', function () {
          logger.info(`Scanning started...`);
        });

        noble.once('scanStop', function () {
          logger.info(`Scanning stopped.`);
        });

        // Start the scan and go to next state APP_STATE_SCANNING
        await this.startScanning();
        this.state = APP_STATE_SCANNING;
        break;
      }
      case APP_STATE_SCANNING: {
        /**
         * This state simply waits for all the expected devices to be
         * discovered before proceeding to APP_STATE_INIT_NEXT_CONNECTION
         * where the actual connection happens.
         */
        let isReadyForConnection = true;

        // Look into the all the targets and make sure they have been discovered.
        for (const targetMAC of this.connectionTargetMACs) {
          if (_.isNil(this.discoveredPeripherals[targetMAC])) {
            // one of the device still not scanned yet.
            isReadyForConnection = false;
            break;
          }
        }
        if (!isReadyForConnection) {
          // Not ready yet, some devices are not discovered yet.
          break;
        }

        logger.info(
          `Both target peripherals are ready to connect. Stop scanning now...`
        );
        await this.stopScanning();
        this.state = APP_STATE_INIT_NEXT_CONNECTION;
        break;
      }
      case APP_STATE_INIT_NEXT_CONNECTION: {
        // Get all the MAC address of devices pending connection.
        const discoveredMACs = Object.keys(this.discoveredPeripherals) || [];

        if (discoveredMACs.length === 0) {
          /**
           * There are no more pending devices to connect. We can go to idle
           * state immediately.
           */
          logger.info(`All devices connected. Going to idle state.`);
          this.currentConnecting = null;
          this.state = APP_STATE_IDLE;
          break;
        }

        // Find the next device to connect
        let deviceMAC = discoveredMACs.shift();
        logger.info(`Next MAC: ${deviceMAC}`);
        this.currentConnecting = {
          deviceMAC,
          peripheral: this.discoveredPeripherals[deviceMAC]
        };

        // Initiate the connection to this device (this.currentConnecting)
        logger.info(
          `Connecting to peripheral ${this.currentConnecting.peripheral.id} next...`
        );
        await this.connectPeripheral(this.currentConnecting.peripheral);
        this.state = APP_STATE_CONNECTING_DEVICE;
        break;
      }
      case APP_STATE_CONNECTING_DEVICE: {
        /**
         * This stage happens right after APP_STATE_INIT_NEXT_CONNECTION determines
         * which is the next device to connect to and initiates a connection.
         *
         * This loop will stay in this state until the current connecting device
         * is finally connected.
         *
         * Once the device is connected, it will be 'pushed' into this.connectedPeripherals
         * list (see connectPeripheral() which is called in the previous state)
         */
        if (this.connectedPeripherals.has(this.currentConnecting.peripheral)) {
          // Peripheral is connected, go back to APP_STATE_INIT_NEXT_CONNECTION
          logger.info(`Moving to next connection target...`);
          // Remove from pending list
          delete this.discoveredPeripherals[this.currentConnecting.deviceMAC];
          this.state = APP_STATE_INIT_NEXT_CONNECTION;
        } else {
          logger.info(
            `Waiting to connect to ${this.currentConnecting.peripheral.id}`
          );
        }
        break;
      }
      case APP_STATE_IDLE: {
        // all should have peripherals already.
        const rfidStatus = this.peripheralStatuses[this.rfidMAC];
        const lockStatus = this.peripheralStatuses[this.lockMAC];

        if (rfidStatus && lockStatus) {
          const needReinit =
            rfidStatus.status === PERIPHERAL_STATE_DISCONNECTED ||
            lockStatus.status === PERIPHERAL_STATE_DISCONNECTED;

          if (needReinit) {
            logger.info(
              `RFID status: ${rfidStatus.status}, Lock status: ${lockStatus.status}`
            );
            logger.info(
              `Detected disconnection, resetting all connections on next loop.`
            );
            this.state = APP_STATE_INIT;
          }
        }
        break;
      }
    }

    this.nextLoop();
  }

  async nextLoop() {
    const inst = this;
    this.timeoutLoop = setTimeout(async function () {
      await inst.loop();
    }, 1000);
  }

  async initBLE() {
    logger.info(`Intitializing BLE...`);
    this.state = APP_STATE_IDLE;
    this.nextLoop();
  }

  static getInstance() {
    if (BLELib._instance === undefined) {
      BLELib._instance = new BLELib();
    }
    return BLELib._instance;
  }
}
