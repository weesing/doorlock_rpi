export const PERIPHERAL_STATE_DISCONNECTED = 0;
export const PERIPHERAL_STATE_CONNECTING = 1;
export const PERIPHERAL_STATE_SUBSCRIBING = 2;
export const PERIPHERAL_STATE_SUBSCRIBED = 2;

export class PeripheralStatus {
  constructor(args) {
    this._status = PERIPHERAL_STATE_DISCONNECTED;
    this._peripheral = null;
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
    this._dataStringHistory = [];
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

  get dataStringHistory() {
    return this._dataStringHistory;
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
    this._history = [];
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
  }

  reset() {
    this._status = PERIPHERAL_STATE_DISCONNECTED;
    this._peripheral = null;
    this._characteristics = null;
    this.clearBuffer();
  }
}
