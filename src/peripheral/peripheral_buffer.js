export class PeripheralBuffer {
  constructor() {
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
    this._dataStringHistory = [];
  }

  get buffer() {
    return this._buffer;
  }

  get dataString() {
    return this._dataString;
  }

  get dataStringHistory() {
    return this._dataStringHistory;
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
}