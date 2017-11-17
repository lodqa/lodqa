const template = require('./template')

module.exports = class {
  constructor(dom, integratedDataset) {
    this._dom = dom
    this._integratedDataset = integratedDataset

    integratedDataset.on('answer_index_update_event', () => this.render())
  }

  render() {
    const before = this._dom.innerHTML
    const after = template(this._integratedDataset.integratedAnswerIndex)
    if (before !== after) {
      this._dom.innerHTML = after
    }
  }
}
