export class PeripheralBufferHistory {
  constructor({ dataString = '', logged = false } = {}) {
    this._dataString = dataString;
    this._logged = logged;
    this._processed = false;
  }

  get logged() {
    return this._logged;
  }

  set logged(logged) {
    this._logged = logged;
  }

  get processed() {
    return this._processed;
  }

  set processed(processed) {
    this._processed = processed;
  }

  get dataString() {
    return this._dataString;
  }
}
