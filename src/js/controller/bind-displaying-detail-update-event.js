const DetailProgressBar = require('../presentation/detail-progress-bar-presentation')

module.exports = function(dom, integratedDataset, name, dataset) {
  const onAnswerButtonClick = (sparqlNumber, isHide) => dataset.updateSparqlHideStatus(sparqlNumber, isHide)

  // Remember an instance of the DetailProgressBar to remove elements from dom and remove listners from the integratedDataset.
  let detailProgressBar
  integratedDataset.on('dataset_displaying_detail_update_event', (selectedName, selectedDataset) => {
    if (selectedName === name) {
      detailProgressBar = creatDetailProgressBar(selectedDataset, onAnswerButtonClick)
      dom.appendChild(detailProgressBar.dom)
    } else {
      if (detailProgressBar && detailProgressBar.dom.parentElement) {
        detailProgressBar.dataset = null
        dom.removeChild(detailProgressBar.dom)
      }
    }
  })
}

function creatDetailProgressBar(selectedDataset, onAnswerButtonClick) {
  const detailProgressBar = new DetailProgressBar(name, onAnswerButtonClick)
  detailProgressBar.showCurrentStatus(selectedDataset.currentStatusOfSparqls)
  detailProgressBar.dataset = selectedDataset

  return detailProgressBar
}
