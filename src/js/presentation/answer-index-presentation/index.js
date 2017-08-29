const show = require('./show')
const updateDisplay = require('./update-display')

module.exports = class {
  constructor(domId) {
    this.domId = domId
  }

  progress(model) {
    show(this.domId, model)
  }

  updateDisplay(model) {
    updateDisplay(this.domId, model)
  }
}
