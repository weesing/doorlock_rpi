import _ from 'lodash';

export class StaticGlobals {
  setVar(varName, varVal) {
    this[varName] = varVal;
  }

  getVar(varName) {
    return this[varName];
  }

  static getInstance() {
    if (_.isNil(StaticGlobals._instance)) {
      StaticGlobals._instance = new StaticGlobals();
    }
    return StaticGlobals._instance;
  }
}