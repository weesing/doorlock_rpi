import _ from 'lodash';
import { PeripheralBufferHistory } from './peripheral_buffer_history';

export const DETECT_DELIMITER = '\r\n';

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

  addHistory(dataString) {
    this.dataStringHistory.push(new PeripheralBufferHistory({ dataString }));
  }

  appendBuffer(buffer = Buffer.from('')) {
    const receivedString = buffer.toString();
    if (_.isEmpty(receivedString)) {
      return;
    }

    /*
     STEP 1:
     Tokenize the received string by delimiter, but preserve the delimiter
     in the tokens if applicable.
    */
    const receivedStringTokens = receivedString
      .split(DETECT_DELIMITER) // split by delimiters
      .filter((token) => token !== '')
      .map((token) => `${token}${DETECT_DELIMITER}`); // put back the delimiters

    /*
     STEP 2: 
     Check whether the received string ends with delimiter. 
     If not, remove the delimiter from the last token.
    */
    if (!receivedString.endsWith(DETECT_DELIMITER)) {
      // get the last token
      let lastToken = receivedStringTokens.splice(
        receivedStringTokens.length - 1,
        1
      )[0];
      // take away the delimiter
      lastToken = lastToken.replace(DETECT_DELIMITER, '');
      // push back
      receivedStringTokens.push(lastToken);
    }

    /*
     STEP 3:
     Add the tokens into the history
    */
    let lastHistory;
    if (this.dataStringHistory.length > 0) {
      lastHistory = this.dataStringHistory.splice(
        this.dataStringHistory.length - 1,
        1
      )[0];
    }
    let currReceivedStringToken = receivedStringTokens.shift();
    let lastHistoryDataString = lastHistory ? lastHistory.dataString : '';
    if (lastHistoryDataString.endsWith(DETECT_DELIMITER)) {
      // last history already ended, push it back.
      this.addHistory(lastHistoryDataString);
      // push new history data onto history
      this.addHistory(currReceivedStringToken);
    } else {
      // last history not ended, create new history with appended data string
      lastHistoryDataString = `${lastHistoryDataString}${currReceivedStringToken}`;
      this.addHistory(lastHistoryDataString);
    }

    // push the rest of the tokens onto history
    while (!_.isEmpty(receivedStringTokens)) {
      let currReceivedStringToken = receivedStringTokens.shift();
      this.addHistory(currReceivedStringToken);
    }

    this._dataString += buffer.toString();
    this._buffer = Buffer.from(this._dataString);
  }

  clearBuffer() {
    this._dataString = '';
    this._buffer = Buffer.from(this._dataString);
    this._dataStringHistory = [];
  }
}
