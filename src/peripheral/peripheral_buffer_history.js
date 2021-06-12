export class PeripheralBufferHistory {
  constructor({ dataString = '', sent = false } = {}) {
    this._dataString = dataString;
    this._sent = sent;
  }

  set sent(sent) {
    this._sent = sent;
  }

  get dataString() {
    return this._dataString;
  }
}
