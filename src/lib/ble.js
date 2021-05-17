import util from "util";
import _ from "lodash";
import noble from "noble";
import path from "path";
const Peripheral = noble.Peripheral;

const STATE_DISCONNECTED = 0;
const STATE_CONNECTING = 1;
const STATE_CONNECTED = 2;

const APP_STATE_INIT = 0;
const APP_STATE_SCANNING = 1;
const APP_STATE_CONNECTING = 2;
const APP_STATE_CONNECTING_DEVICE = 3;
const APP_STATE_IDLE = 4;

const DISCOVER_DELAY = 3000;

export class BLELib {
  constructor() {
    const secrets = SecretsLoader.loadSecrets();
    console.log(secrets);
    this.rfidMAC = secrets.rfidMAC.toLowerCase();
    this.lockMAC = secrets.lockMAC.toLowerCase();
    this.connectionTargetMACs = [this.rfidMAC, this.lockMAC];
    this.meMAC = secrets.nodeMAC.toLowerCase();
    this.connectedPeripherals = new Set();
    this.pendingConnectionPeripherals = {};
    this.peripheralStatuses = {
      [this.rfidMAC]: {
        status: 0,
        peripheral: null,
        buffer: Buffer.from(""),
      },
      [this.lockMAC]: {
        status: 0,
        peripheral: null,
        buffer: Buffer.from(""),
      },
    };
    this.isScanning = false;
    this.state = APP_STATE_INIT;
    this.currentConnecting = null;
  }

  async startScanning() {
    if (this.isScanning) {
      console.log("Already scanning");
      return;
    }
    this.isScanning = true;
    noble.startScanning([], false, function (error) {
      if (error) {
        console.log(`Error on start scan.`);
        console.log(util.inspect(error, { depth: 99, colors: true }));
        return;
      }
    });
  }

  async stopScanning() {
    noble.stopScanning();
    this.isScanning = false;
  }

  async onStateChange(state) {
    console.log(`State changed to ${state}`);
  }

  async onScanStart() {
    console.log(`Scanning started...`);
  }

  async onScanStop() {
    console.log(`Scanning stopped.`);
  }

  async onDataReceived(peripheral, data, isNotification) {
    console.log(
      `Received - ${util.inspect(data, { depth: 99, colors: true })}`
    );
    if (peripheral.id === this.rfidMAC) {
      console.log(`Source of data - RFID, forwarding to door lock...`);
      const lockCharacteristic = _.get(
        this.peripheralStatuses[this.lockMAC],
        "characteristics"
      );
      if (!lockCharacteristic) {
        console.debug(`Door lock not connected yet, aborting data sending.`);
        return;
      }
      lockCharacteristic.write(data);
    } else if (peripheral.id === this.lockMAC) {
      console.log(`Data received from door lock.`);
    }
  }

  async discoverAndSubscribe(peripheral) {
    const inst = this;
    console.log(
      `Connected peripheral ${peripheral.id}. Discovering services and characteristics...`
    );

    peripheral.discoverSomeServicesAndCharacteristics(
      ["ffe0"],
      ["ffe1"],
      function (error, services, characteristics) {
        console.log(
          `DISCOVERED SERVICES AND CHARACTERISTICS on ${peripheral.id}`
        );
        console.log(
          util.inspect(
            {
              error,
              services: services.map((service) =>
                _.omit(service, ["_noble", "characteristics"])
              ),
              characteristics: characteristics.map((char) =>
                _.pick(char, ["uuid", "name", "type", "properties"])
              ),
            },
            { depth: 99, colors: true }
          )
        );

        let firstChar = characteristics[0];
        console.log(
          `Subscribing to characteristics ${firstChar.uuid} on peripheral ${peripheral.id}`
        );
        firstChar.on("data", (data, isNotification) => {
          inst.onDataReceived(peripheral, data, isNotification);
        });
        firstChar.subscribe(function (error) {
          if (error) {
            console.log(util.inspect(error, { depth: 99, colors: true }));
          } else {
            console.log(
              `******* Subscribed to ${firstChar.uuid} on peripheral ${peripheral.id} ********`
            );
            inst.connectedPeripherals.add(peripheral);
            inst.peripheralStatuses[peripheral.id] = {
              status: STATE_CONNECTED,
              peripheral,
              characteristics: firstChar,
            };
            inst.nextSubscriptionTimeout = null;
          }
        });
      }
    );
  }

  async onPeripheralConnect(peripheral) {
    console.log(`Peripheral ${peripheral.id} +++ CONNECTED +++`);
    const inst = this;

    if (this.nextSubscriptionTimeout) {
      console.log(`>>>>>> Reconnection detected, cancelling timeout.`);
      clearTimeout(this.nextSubscriptionTimeout);
    }
    console.log(
      `Queuing peripheral ${peripheral.id} for discovery and subscription.`
    );
    this.nextSubscriptionTimeout = setTimeout(function () {
      inst.discoverAndSubscribe(peripheral);
    }, DISCOVER_DELAY);
  }

  async onPeripheralDisconnect(peripheral) {
    console.log(`Peripheral ${peripheral.id} --- DISCONNECTED ---`);
    this.connectedPeripherals.delete(peripheral);
    if (this.peripheralStatuses[peripheral.id]) {
      this.peripheralStatuses[peripheral.id].status = STATE_CONNECTING;
      await this.connectPeripheral(peripheral);
    }
  }

  async initPeripheral(peripheral) {
    const inst = this;
    console.log("Peripheral initializing.");
    peripheral.once("connect", function () {
      inst.onPeripheralConnect(peripheral);
    });

    peripheral.once("disconnect", function () {
      inst.onPeripheralDisconnect(peripheral);
    });
    console.log("Peripheral initialized.");
  }

  async connectPeripheral(peripheral) {
    this.stopScanning();
    ///// Attempt to connect to peripheral.
    this.peripheralStatuses[peripheral.id] = {
      status: STATE_CONNECTING,
      peripheral,
    };
    console.log(`Initializing peripheral ${peripheral.id}`);
    await this.initPeripheral(peripheral);
    peripheral.connect(function (error) {
      if (error) {
        console.log(
          `Errors on connect to ${peripheral.id} - ${util.inspect(error, {
            depth: 99,
            colors: true,
          })}`
        );
      }
    });
  }

  async disconnectPeripheral(peripheral) {
    console.log(`Disconnecting ${peripheral.id}`);
    peripheral.disconnect();
    delete this.peripheralStatuses[peripheral.id].peripheral;
    delete this.peripheralStatuses[peripheral.id].characteristics;
  }

  async onDiscover(peripheral) {
    const targetSet = new Set(this.connectionTargetMACs);
    if (targetSet.has(peripheral.id.toLowerCase())) {
      console.log(
        `>>>> Discovered peripheral ${util.inspect(
          _.pick(peripheral, ["id", "address"]),
          { depth: 99, colors: true }
        )}, adding to pending connection list. <<<<`
      );

      this.pendingConnectionPeripherals[peripheral.id.toLowerCase()] =
        peripheral;
    }
  }

  async disconnectAllDevices() {
    console.log(`Disconnecting all devices`);
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
        console.log(`First time connection. Starting scan...`);
        await this.stopScanning();
        await this.startScanning();
        this.state = APP_STATE_SCANNING;
        break;
      }
      case APP_STATE_SCANNING: {
        let isReadyForConnection = true;
        // All devices must be scanned in order to be ready for connections.
        for (const targetMAC of this.connectionTargetMACs) {
          if (_.isNil(this.pendingConnectionPeripherals[targetMAC])) {
            isReadyForConnection = false;
            break;
          }
        }
        if (!isReadyForConnection) {
          // Not ready yet, some devices are not discovered yet.
          break;
        }

        console.log(
          `Both target peripherals are ready to connect. Stop scanning now...`
        );
        await this.stopScanning();
        this.state = APP_STATE_CONNECTING;
        break;
      }
      case APP_STATE_CONNECTING: {
        const deviceMACs = Object.keys(this.pendingConnectionPeripherals) || [];
        if (deviceMACs.length === 0) {
          console.log(`All devices connected. Going to idle state.`);
          this.currentConnecting = null;
          this.state = APP_STATE_IDLE;
          break;
        }
        let deviceMAC = deviceMACs.shift();
        console.log(`Next MAC: ${deviceMAC}`);
        this.currentConnecting = {
          deviceMAC,
          peripheral: this.pendingConnectionPeripherals[deviceMAC],
        };
        console.log(
          `Connecting to peripheral ${this.currentConnecting.peripheral.id} next...`
        );
        await this.connectPeripheral(this.currentConnecting.peripheral);
        this.state = APP_STATE_CONNECTING_DEVICE;
        break;
      }
      case APP_STATE_CONNECTING_DEVICE: {
        if (this.connectedPeripherals.has(this.currentConnecting.peripheral)) {
          console.log(
            `Peripheral already connected. Moving to next connection target...`
          );
          // Remove from pending list
          delete this.pendingConnectionPeripherals[
            this.currentConnecting.deviceMAC
          ];
          this.state = APP_STATE_CONNECTING;
        }
        break;
      }
      case APP_STATE_IDLE: {
        // all should have peripherals already.
        const rfidStatus = this.peripheralStatuses[this.rfidMAC];
        const lockStatus = this.peripheralStatuses[this.lockMAC];

        const needReinit =
          rfidStatus.status === STATE_DISCONNECTED ||
          lockStatus.status === STATE_DISCONNECTED;

        if (needReinit) {
          console.log(
            `RFID status: ${rfidStatus.status}, Lock status: ${lockStatus.status}`
          );
          console.log(
            `Detected disconnection, resetting all connections on next loop.`
          );
          this.state = APP_STATE_INIT;
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
    const inst = this;
    console.log(`Intitializing BLE...`);
    noble.once("scanStart", function () {
      inst.onScanStart();
    });

    noble.once("scanStop", function () {
      inst.onScanStop();
    });

    noble.on("discover", function (peripheral) {
      inst.onDiscover(peripheral);
    });
    this.state = APP_STATE_IDLE;
    this.nextLoop();
  }
}
