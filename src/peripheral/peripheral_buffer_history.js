import { v4 as uuidv4 } from 'uuid';

export class PeripheralBufferHistory {
  constructor({ dataString = '', logged = false } = {}) {
    this._id = uuidv4();
    this._dataString = dataString;
    this._logged = logged;
    this._processed = false;
  }

  get id() {
    return this._id;
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

  set dataString(dataString) {
    this._dataString = dataString;
  }
}
