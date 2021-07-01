import { v4 as uuidv4 } from 'uuid';

export const PROCESS_STATE_UNPROCESSED = 'unprocessed';
export const PROCESS_STATE_PROCESSING = 'processing';
export const PROCESS_STATE_PROCESSED = 'processed';
export const PROCESS_STATE_FAILED = 'failed';

export class PeripheralBufferHistory {
  constructor({ dataString = '', logged = false } = {}) {
    this._id = uuidv4();
    this._dataString = dataString;
    this._logged = logged;
    this._processState = PROCESS_STATE_UNPROCESSED;
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

  get processState() {
    return this._processState;
  }

  set processState(processState) {
    this._processState = processState;
  }

  get dataString() {
    return this._dataString;
  }

  set dataString(dataString) {
    this._dataString = dataString;
  }
}
