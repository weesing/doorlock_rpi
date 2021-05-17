
Install the prerequisites
=========================
`sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev`

Install nodejs v8 - `https://www.makersupplies.sg/blogs/tutorials/how-to-install-node-js-and-npm-on-the-raspberry-pi`

Install nodemon - `sudo npm install -g nodemon`

- Ensure that your version of node is not > 8

## Secrets
- Make sure you have your secrets contained within `secrets/secrets.json` file.
- Secrets file should contain:
  - RFID module BLE MAC address - `rfidMAC`
  - Door lock BLE MAC address - `lockMAC`
  - NodeJS server (host machine) BT MAC address - `nodeMAC`
- See `secrets/secrets.sample.json` for more info.
- To load your secrets from somewhere else, please take a look at `src/lib/secrets_loader.js` and modify the `loadSecrets()` function accordingly.

Stop and disable the bluetooth service
=========================
`sudo systemctl stop bluetooth`

`sudo systemctl disable bluetooth`

Install the required npm libraries
==================================
`npm install lodash --save`

`npm install bleno --save`

`npm install onoff --save`


Run the app
============
`sudo nodemon`