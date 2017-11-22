const bindHandlerToCheckbox = require('../bind-handler-to-checkbox')

module.exports = function(dom, integratedDataset) {
  // To switch showing detail of progress
  const onClickDetailCheckbox = (event) => integratedDataset.displayingDetail = (event.target.checked ? event.target.dataset.name : '')
  bindHandlerToCheckbox(dom, '.show-detail-progress-bar', onClickDetailCheckbox)
}
