import util from 'util';
import _ from 'lodash';
import noble from 'noble';
import logger from '../lib/logger';
import config from '../lib/config';

import {
  PERIPHERAL_STATE_CONNECTING,
  PERIPHERAL_STATE_SUBSCRIBING,
  PERIPHERAL_STATE_SUBSCRIBED,
  PeripheralStatus
} from '../peripheral/peripheral_status';

const SUBSCRIPTION_DELAY = 1000;

export class ConnectionManager {
  constructor(targetPeripheralIds) {
    this.targetPeripheralIds = targetPeripheralIds;
    this._connectionStatuses = {};
    for (const targetId of targetPeripheralIds) {
      this._connectionStatuses[targetId] = new PeripheralStatus();
    }

    this.discoveredPeripherals = {};
    this.connectedPeripheralIds = new Set();
    this.subscribedPeripheralIds = new Set();
    this.isScanning = false;
    this.subscriptionTimeouts = {};

    this.dataReceiver = null;
    this.onDataReceivedFn = null;
    this.onPeripheralSubscribedFn = null;
  }

  get connectionStatuses() {
    return this._connectionStatuses;
  }

  getPeripheralCharacteristics(peripheralId) {
    const status = this._connectionStatuses[peripheralId];
    if (!status || status.status !== PERIPHERAL_STATE_SUBSCRIBED) {
      return null;
    }

    return status.characteristic;
  }

  onPeripheralSubscribed(peripheral, characteristic) {
    logger.info(
      `[${peripheral.id}] >>>> Subscribed to ${characteristic.uuid} on peripheral <<<<`
    );
    const peripheralId = peripheral.id;
    this.subscribedPeripheralIds.add(peripheralId);
    this._connectionStatuses[peripheralId].bulkSet({
      status: PERIPHERAL_STATE_SUBSCRIBED,
      peripheral,
      characteristic
    });
    const buffer = Buffer.from('connected');
    characteristic.write(buffer);

    if (this.onPeripheralSubscribedFn) {
      // Callback on peripheral subscribed
      this.onPeripheralSubscribedFn(peripheralId);
    }

    if (this.connectedPeripheralIds.size < this.targetPeripheralIds.length) {
      // More devices to connect, continue connection.
      logger.info(`More devices pending connection, continuing scan...`);
      // fire and forget
      this.restartScanning();
    } else {
      logger.info(`All devices connected, not restarting scan`);
    }
  }

  async subscribeToPeripheral(peripheral) {
    this._connectionStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_SUBSCRIBING,
      peripheral
    });

    const onSvcCharDiscoverCb = (error, services, characteristics) => {
      logger.info(
        `[${peripheral.id}] Discovered services and characteristics for ${peripheral.id}`
      );
      if (error) {
        this.disconnectPeripheral(peripheral);
        return;
      }

      let characteristic = characteristics[0];
      logger.info(
        `[${peripheral.id}] Subscribing to characteristics ${characteristic.uuid}`
      );
      characteristic.on('data', (data, isNotification) => {
        /*
        logger.info(
          `[${peripheral.id}] Received buffer -> ${util.inspect(data, {
            depth: 10,
            colors: true
          })} (${data.toString()})`
        );
*/
        this.onDataReceivedFn(peripheral, data, isNotification);
      });
      characteristic.subscribe((error) => {
        if (error) {
          logger.info(util.inspect(error, { depth: 10, colors: true }));
        } else {
          this.onPeripheralSubscribed(peripheral, characteristic);
        }
      });
    };
    const discoverConfig = _.get(config, `connection_manager.discover`);
    const serviceUuid = _.get(discoverConfig, 'service_uuid');
    const characteristicUuid = _.get(discoverConfig, 'characteristic_uuid');
    peripheral.discoverSomeServicesAndCharacteristics(
      [serviceUuid],
      [characteristicUuid],
      onSvcCharDiscoverCb
    );
  }

  connectPeripheral(peripheral) {
    // Attempt to connect to peripheral.
    // Set state of peripheral to connecting.
    this._connectionStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_CONNECTING,
      peripheral
    });

    logger.info(`[${peripheral.id}] Initializing peripheral events`);

    // Init callback for peripheral connected
    const onPeripheralConnected = (peripheral) => {
      const peripheralId = peripheral.id;
      logger.info(`[${peripheralId}] >>>> Peripheral CONNECTED <<<<`);

      this.connectedPeripheralIds.add(peripheralId);

      // Create the timeout that does the subscription on the peripheral
      // Note that this timeout can be cancelled when peripheral
      // disconnects (see disconnectPeripheral())
      const subscriptionTimeout = setTimeout(async () => {
        logger.info(
          `[${peripheralId}] Initiate service and characteristics discovery and subscription.`
        );

        logger.info(
          `[${peripheralId}] Discovering services and characteristics...`
        );

        await this.subscribeToPeripheral(peripheral);
      }, SUBSCRIPTION_DELAY);

      logger.info(`[${peripheralId}] Timeout for subscription created`);

      // If there was any existing timeout, clear it before replacing it.
      if (this.subscriptionTimeouts[peripheralId]) {
        clearTimeout(this.subscriptionTimeouts[peripheralId]);
        logger.info(
          `[${peripheralId}] Previous timeout cancelled before replacement`
        );
      }
      this.subscriptionTimeouts[peripheralId] = subscriptionTimeout;
    };

    // Init callback for peripheral disconnected
    const onPeripheralDisconnect = (peripheral) => {
      logger.warn(`[${peripheral.id}] >>>> Peripheral DISCONNECTED <<<<`);
      this.disconnectPeripheral(peripheral);
      // Fire and forget
      this.restartScanning();
    };

    peripheral.once('connect', async function () {
      onPeripheralConnected(peripheral);
    });
    peripheral.once('disconnect', async function () {
      onPeripheralDisconnect(peripheral);
    });

    logger.info(`[${peripheral.id}] Peripheral events initialized.`);

    logger.info(`[${peripheral.id}] Initiating connection...`);
    // Initiate the connection after all the events have been registered above.
    peripheral.connect((error) => {
      if (error) {
        logger.info(
          `[${peripheral.id}] Errors on connect to - ${util.inspect(error, {
            depth: 10,
            colors: true
          })}`
        );
      }
    });
  }

  disconnectPeripheral(peripheral) {
    const peripheralId = peripheral.id;
    logger.info(`[${peripheralId}] Disconnecting peripheral`);
    try {
      peripheral.disconnect();
    } catch (e) {
      logger.error(`[${peripheralId}] Error disconnecting from peripheral.`);
      logger.error(e);
    }
    this._connectionStatuses[peripheralId].reset();
    this.dataReceiver.clearBufferByPeripheral(peripheralId);
    // clear from connected and subscribed list.
    this.connectedPeripheralIds.delete(peripheralId);
    this.subscribedPeripheralIds.delete(peripheralId);

    // Clear all the subscription timeouts if any
    if (this.subscriptionTimeouts[peripheralId]) {
      clearTimeout(this.subscriptionTimeouts[peripheralId]);
      this.subscriptionTimeouts[peripheralId] = null;
      logger.warn(
        `[${peripheralId}] Previous subscription timeout cancelled due to disconnection.`
      );
    }
  }

  async onPeripheralDiscovered(peripheral) {
    const targetSet = new Set(this.targetPeripheralIds);
    const peripheralId = peripheral.id.toLowerCase();
    if (targetSet.has(peripheralId)) {
      logger.info(
        `[${peripheralId}] >>>> Discovered peripheral ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 10, colors: true }
        )}`
      );
      const status = this._connectionStatuses[peripheralId].status;
      if (
        status === PERIPHERAL_STATE_CONNECTING ||
        status === PERIPHERAL_STATE_SUBSCRIBING ||
        status === PERIPHERAL_STATE_SUBSCRIBED
      ) {
        // This shouldn't happen. But try clearing connection and reconnect again.
        logger.warn(
          `[${peripheralId}] !!!! Repeated device being discovered while being subscribed. Resetting peripheral status. Is this a bug?`
        );
        // attempt to disconnect
        this.disconnectPeripheral(
          this._connectionStatuses[peripheralId].peripheral
        );
      }
      // Start connecting.
      this.connectPeripheral(peripheral);
    } else {
      logger.trace(
        `Found unknown device ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 10, colors: true }
        )}`
      );
    }
  }

  startScanning() {
    if (this.isScanning) {
      logger.info('Already scanning, skipping scan trigger.');
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      // Start the scanning.
      noble.startScanning([], false, (error) => {
        if (error) {
          logger.error(`Error on start scan.`);
          logger.error(util.inspect(error, { depth: 10, colors: true }));
          reject(error);
        }
        resolve();
      });
    });
  }

  stopScanning() {
    if (!this.isScanning) {
      logger.info('Scanning has not started, skipping stop trigger...');
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      noble.stopScanning(() => {
        resolve();
      });
    });
  }

  async restartScanning() {
    await this.stopScanning();
    await this.startScanning();
  }

  async startConnections(dataReceiver) {
    this.dataReceiver = dataReceiver;
    this.onDataReceivedFn = dataReceiver.onDataReceived.bind(dataReceiver);
    this.onPeripheralSubscribedFn =
      dataReceiver.onPeripheralSubscribed.bind(dataReceiver);
    this.onPeripheralDisconnected =
      dataReceiver.onPeripheralDisconnected.bind(dataReceiver);
    this.onPeripheralConnected =
      dataReceiver.onPeripheralConnected.bind(dataReceiver);

    const onScanStart = () => {
      this.isScanning = true;
      logger.debug(`Scanning started`);
    };
    const onScanStop = () => {
      this.isScanning = false;
      logger.debug(`Scanning stopped`);
    };

    noble.on('discover', this.onPeripheralDiscovered.bind(this));
    noble.on('scanStart', onScanStart.bind(this));
    noble.on('scanStop', onScanStop.bind(this));

    // Start the scan
    await this.restartScanning();
  }
}
