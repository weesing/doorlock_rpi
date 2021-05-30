export const PERIPHERAL_STATE_DISCONNECTED = 0;
export const PERIPHERAL_STATE_CONNECTING = 1;
export const PERIPHERAL_STATE_SUBSCRIBING = 2;
export const PERIPHERAL_STATE_SUBSCRIBED = 2;

export class PeripheralStatus {
  constructor(args) {
    this._status = PERIPHERAL_STATE_DISCONNECTED;
    this._peripheral = null;
    this._characteristic = null;
  }

  get peripheral() {
    return this._peripheral;
  }

  get status() {
    return this._status;
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

  reset() {
    this._status = PERIPHERAL_STATE_DISCONNECTED;
    this._peripheral = null;
    this._characteristics = null;
  }
}
