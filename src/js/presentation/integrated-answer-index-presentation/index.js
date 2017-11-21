const template = require('./template')
const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')

module.exports = class {
  constructor(dom, integratedDataset) {
    this._dom = dom
    this._integratedDataset = integratedDataset

    integratedDataset.on('answer_index_update_event', () => this.render())

    // To switch showing detail of progress
    const onClickDetailCheckbox = (event) => integratedDataset.displayingDetail = (event.target.checked ? event.target.dataset.name : '')
    bindHandlerToCheckbox(dom, '.show-detail-progress-bar', onClickDetailCheckbox)
  }

  render() {
    const before = this._dom.innerHTML
    const after = template(this._integratedDataset.integratedAnswerIndex)
    if (before !== after) {
      this._dom.innerHTML = after
    }
  }
}
