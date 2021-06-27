
# Overview
- This is a **NodeJS (Express) API Server** that acts as the central of all communications in the door lock system.
![alt text](.\docs\communication.jpg)
- Receives scanned keys from RFID module, verifies it and sends a toggle command to Lock module to lock/unlock.
- It can also store settings for the other modules so that the user can fine tune some of the actuating parameters without having to re-program the Arduino modules.
- All data is stored in **Redis**.

## Other modules
| Git Repository | Module |
|--|--|
| https://github.com/weesing/doorlock | The main door lock module.
| https://github.com/weesing/doorlock_rpi | This API Server repository.
| https://github.com/weesing/doorlock_rfid | RFID module for scanning RFID tags.

# Steps to prepare & run
## Install the prerequisites
- Execute the following:
```
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
```

- Install nodejs v8
```
https://www.makersupplies.sg/blogs/tutorials/how-to-install-node-js-and-npm-on-the-raspberry-pi
```

- Install nodemon (optional)
```
npm install -g nodemon
```

:warning: **IMPORTANT!!! Ensure that your version of node is not > 8**

> Tip: You can follow the instructions here to install NodeJS version 8 - https://www.instructables.com/Install-Nodejs-and-Npm-on-Raspberry-Pi/

## Install the required npm libraries
```
npm install
```

# Run the app
Using `nodemon`
```
sudo nodemon
```
OR using `node`
```
sudo npm start
```
> The command requires `sudo` because the server needs access to the device.
# Running in test mode
```
npm run testmode
```
- This command will run the `ble_engine_test.js` instead.
- This logic class (ble_engine_test) uses the `testMAC` in your secrets JSON file to test connectivity.

# Secrets
- The file `secrets/secrets.json` is required to successfully launch the application.
- A sample `secrets.sample.json` has been provided as a template to construct the `secrets.json` file.

| Field | Description |
|--|--|
| rfidMAC | BLE MAC address of the RFID module. Powered by Arduino - https://github.com/weesing/doorlock_rfid |
| lockMAC | BLE MAC address of the Lock main module. Powered by Arduino - https://github.com/weesing/doorlock |
| nodeMAC | BLE MAC address of this NodeJS API Server. |
| testMAC | BLE MAC address of the Arduino for connectivity testing. |
| apiKey | API Key for communicating with this NodeJS API Server. |
| lockSecret | Shared secret between this NodeJS API Server and the Lock main module. |

# References
- https://www.npmjs.com/package/noble
- https://create.arduino.cc/projecthub/alexis-santiago-allende/arduino-101-connects-with-raspberry-pi-zero-w-63adc0
- https://create.arduino.cc/projecthub/virgilvox/intel-curie-ble-nodejs-990766
