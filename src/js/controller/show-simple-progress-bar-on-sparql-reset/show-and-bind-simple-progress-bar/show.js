const SimpleProgressBar = require('../../../presentation/simple-progress-bar-presentation')

module.exports = function show(dom, datasetName, onClickDetailCheckbox) {
  // Append new components
  const simpleProgressBar = new SimpleProgressBar(datasetName, onClickDetailCheckbox)
  dom.appendChild(simpleProgressBar.dom)

  return simpleProgressBar
}
