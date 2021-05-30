import util from 'util';
import _ from 'lodash';
import noble from 'noble';
import logger from './logger';
import config from './config';

import {
  PERIPHERAL_STATE_DISCONNECTED,
  PERIPHERAL_STATE_CONNECTING,
  PERIPHERAL_STATE_SUBSCRIBING,
  PERIPHERAL_STATE_SUBSCRIBED,
  PeripheralStatus
} from '../peripheral/peripheral_status';

const LOOP_FREQUENCY = 1000;

export class ConnectionManager {
  constructor(targetMACs) {
    this.connectionTargetMACs = targetMACs;
    this.connectionStatuses = {};
    for (const targetMAC of targetMACs) {
      this.connectionStatuses[targetMAC] = new PeripheralStatus();
    }

    this.discoveredPeripherals = {};
    this.connectedPeripheralIds = new Set();
    this.subscribedPeripheralIds = new Set();
    this.isScanning = false;

    this.dataReceiver = null;
    this.onDataReceivedFn = null;
  }

  get peripheralStatuses() {
    return this.connectionStatuses;
  }

  onPeripheralSubscribed(peripheral, characteristic) {
    logger.info(
      `[${peripheral.id}] >>>> Subscribed to ${characteristic.uuid} on peripheral <<<<`
    );
    this.subscribedPeripheralIds.add(peripheral.id);
    this.peripheralStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_SUBSCRIBED,
      peripheral,
      characteristic: characteristic
    });
    const buffer = Buffer.from('echo');
    characteristic.write(buffer);
  }

  async subscribeToPeripheral(peripheral) {
    this.peripheralStatuses[peripheral.id].bulkSet({
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
        logger.info(
          `[${peripheral.id}] Received buffer -> ${util.inspect(data, {
            depth: 10,
            colors: true
          })} (${data.toString()})`
        );
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

  async connectPeripheral(peripheral) {
    // Attempt to connect to peripheral.
    // Set state of peripheral to connecting.
    this.peripheralStatuses[peripheral.id].bulkSet({
      status: PERIPHERAL_STATE_CONNECTING,
      peripheral
    });

    logger.info(`[${peripheral.id}] Initializing peripheral events`);

    // Init callback for peripheral connected
    const onPeripheralConnected = async (peripheral) => {
      const peripheralId = peripheral.id;
      logger.info(`[${peripheralId}] >>>> Peripheral CONNECTED <<<<`);

      this.connectedPeripheralIds.add(peripheralId);

      process.nextTick(async () => {
        logger.info(
          `[${peripheralId}] Initiate service and characteristics discovery and subscription.`
        );

        logger.info(
          `[${peripheralId}] Discovering services and characteristics...`
        );

        await this.subscribeToPeripheral(peripheral);

        if (
          this.connectedPeripheralIds.size < this.connectionTargetMACs.length
        ) {
          // More devices to connect, continue connection.
          logger.info(`More devices pending connection, continuing scan...`);
          this.restartScanning();
        } else {
          logger.info(`All devices connected, not restarting scan`);
        }
      });
    };

    // Init callback for peripheral disconnected
    const onPeripheralDisconnect = async (peripheral) => {
      logger.warn(`[${peripheral.id}] >>>> Peripheral DISCONNECTED <<<<`);
      this.disconnectPeripheral(peripheral);
      this.restartScanning();
    };

    peripheral.once('connect', async function () {
      await onPeripheralConnected(peripheral);
    });
    peripheral.once('disconnect', async function () {
      await onPeripheralDisconnect(peripheral);
    });

    logger.info(`[${peripheral.id}] Peripheral events initialized.`);

    logger.info(`[${peripheral.id}] Initiating connection...`);
    // Initiate the connection after all the events have been registered above.
    peripheral.connect(function (error) {
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

  async disconnectPeripheral(peripheral) {
    const peripheralId = peripheral.id;
    logger.info(`[${peripheralId}] Disconnecting peripheral`);
    try {
      peripheral.disconnect();
    } catch (e) {
      logger.error(`[${peripheralId}] Error disconnecting from peripheral.`);
      logger.error(e);
    }
    this.peripheralStatuses[peripheralId].reset();
    this.dataReceiver.clearBufferByPeripheral(peripheralId);
    // clear from connected and subscribed list.
    this.connectedPeripheralIds.delete(peripheralId);
    this.subscribedPeripheralIds.delete(peripheralId);
  }

  onPeripheralDiscovered(peripheral) {
    const targetSet = new Set(this.connectionTargetMACs);
    const peripheralId = peripheral.id.toLowerCase();
    if (targetSet.has(peripheralId)) {
      // Add to list of discovered peripherals.
      this.discoveredPeripherals[peripheralId] = peripheral;
      logger.info(
        `[${peripheralId}] >>>> Discovered peripheral ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 10, colors: true }
        )}`
      );
    } else {
      logger.debug(
        `Found unknown device ${util.inspect(
          _.pick(peripheral, ['id', 'address']),
          { depth: 10, colors: true }
        )}`
      );
    }
  }

  startScanning() {
    if (this.isScanning) {
      logger.info('Already scanning');
      return;
    }

    // Start the scanning.
    noble.startScanning([], false, function (error) {
      if (error) {
        logger.error(`Error on start scan.`);
        logger.error(util.inspect(error, { depth: 10, colors: true }));
        return;
      }
    });
  }

  stopScanning() {
    noble.stopScanning();
  }

  restartScanning() {
    this.stopScanning();
    this.startScanning();
  }

  async loop() {
    // Start connecting discovered devices
    const discoveredMACs = Object.keys(this.discoveredPeripherals) || [];

    for (const discoveredMAC of discoveredMACs) {
      const discoveredPeripheral = this.discoveredPeripherals[discoveredMAC];
      const status = this.peripheralStatuses[discoveredMAC].status;
      switch (status) {
        case PERIPHERAL_STATE_CONNECTING:
        case PERIPHERAL_STATE_SUBSCRIBING:
        case PERIPHERAL_STATE_SUBSCRIBED: {
          // This shouldn't happen. But try clearing connection and reconnect again.
          logger.warn(
            `[${discoveredMAC}] !!!! Repeated device being discovered while being subscribed. Resetting peripheral status. Is this a bug?`
          );
          // attempt to disconnect
          await this.disconnectPeripheral(discoveredPeripheral);

          // fall through to PERIPHERAL_STATE_DISCONNECTED to continue to connect.
        }
        case PERIPHERAL_STATE_DISCONNECTED: {
          logger.info(
            `[${discoveredMAC}] >>>> Known device discovered, attempting to connect... <<<<`
          );
          // Start connecting.
          await this.connectPeripheral(discoveredPeripheral);
          break;
        }
      }
      // delete from discovered queue
      delete this.discoveredPeripherals[discoveredMAC];
    }
  }

  async startConnections(dataReceiver) {
    this.dataReceiver = dataReceiver;
    this.onDataReceivedFn = dataReceiver.onDataReceived.bind(dataReceiver);

    const onPeripheralDiscoveredCb = this.onPeripheralDiscovered.bind(this);
    noble.on('discover', onPeripheralDiscoveredCb);

    noble.on('scanStart', async function () {
      logger.info(`Scanning started...`);
      this.isScanning = true;
    });

    noble.on('scanStop', async function () {
      logger.warn(`Scanning stopped.`);
      this.isScanning = false;
    });

    // Start the scan
    this.startScanning();

    // Start the loop
    const loopFn = this.loop.bind(this);
    this.loopInterval = setInterval(async () => {
      await loopFn();
    }, LOOP_FREQUENCY);
  }
}
