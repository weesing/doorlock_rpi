
# Install the prerequisites
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

# Stop and disable the bluetooth service
```
sudo systemctl stop bluetooth
sudo systemctl disable bluetooth
```

# Install the required npm libraries
```
npm install
```


# Run the app
Using `nodemon`
```
nodemon
```
OR using `node`
```
node
```

# References
- https://www.npmjs.com/package/noble
- https://create.arduino.cc/projecthub/alexis-santiago-allende/arduino-101-connects-with-raspberry-pi-zero-w-63adc0
- https://create.arduino.cc/projecthub/virgilvox/intel-curie-ble-nodejs-990766