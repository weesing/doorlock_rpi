export class PeripheralStatus {
  constructor(args) {
    this._status = 0;
    this._peripheral = null;
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
    this._characteristic = null;
  }

  get peripheral() {
    return this._peripheral;
  }

  get status() {
    return this._status;
  }

  get buffer() {
    return this._buffer;
  }

  get dataString() {
    return this._dataString;
  }

  get characteristic() {
    return this._characteristic;
  }

  bulkSet(args) {
    const { status, peripheral, characteristic } = args;
    if (status) {
      this._status = status;
    }
    if (peripheral) {
      this._peripheral = peripheral;
    }
    if (characteristic) {
      this._characteristic = characteristic;
    }
  }

  appendBuffer(buffer) {
    this._dataString += buffer.toString();
    this._buffer = Buffer.from(this._dataString);
  }

  clearBuffer() {
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
  }

  reset() {
    this._peripheral = null;
    this._characteristics = null;
    this.clearBuffer();
  }
}
