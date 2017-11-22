const render = require('./render')
const bindShowDetailCheckboxEvent = require('./bind-show-detail-checkbox-event')
const bindDownloadButtonsEvent = require('./bind-download-buttons-event')

module.exports = class {
  constructor(dom, integratedDataset) {
    integratedDataset.on('answer_index_update_event', () => render(dom, integratedDataset))

    bindShowDetailCheckboxEvent(dom, integratedDataset)
    bindDownloadButtonsEvent(dom, integratedDataset)
  }
}
