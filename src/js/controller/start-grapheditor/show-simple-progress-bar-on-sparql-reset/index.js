const SimpleProgressBar = require('../../../presentation/simple-progress-bar-presentation')
const bindHandlerToCheckbox = require('../../../presentation/bind-handler-to-checkbox')

module.exports = function(dom, sparqlProgress) {
  // Create a simpleProgressBar
  new SimpleProgressBar(dom, sparqlProgress)

  // To switch showing detail of progress
  bindHandlerToCheckbox(dom, '.show-detail-progress-bar', ({
    target
  }) => sparqlProgress.showDetail = target.checked)
}
