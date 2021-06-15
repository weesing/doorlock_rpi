export class StaticGlobals {
  setVar(varName, varVal) {
    this[varName] = varVal;
  }

  getVar(varName) {
    return this[varName];
  }

  static getInstance() {
    if (StaticGlobals._instance === null) {
      StaticGlobals._instance = new StaticGlobals();
    }
    return StaticGlobals._instance;
  }
}