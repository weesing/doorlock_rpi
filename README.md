
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

# References
- https://www.npmjs.com/package/noble
- https://create.arduino.cc/projecthub/alexis-santiago-allende/arduino-101-connects-with-raspberry-pi-zero-w-63adc0
- https://create.arduino.cc/projecthub/virgilvox/intel-curie-ble-nodejs-990766
