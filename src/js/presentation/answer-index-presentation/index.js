const updateDisplay = require('./update-display')

module.exports = class {
  constructor(domId) {
    this.domId = domId
  }

  updateDisplay(model) {
    updateDisplay(this.domId, model)
  }
}
