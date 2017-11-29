const DetailProgressBar = require('../presentation/detail-progress-bar-presentation')

module.exports = function(dom, integratedDataset, dataset) {
  const onAnswerButtonClick = (sparqlNumber, isHide) => dataset.updateSparqlHideStatus(sparqlNumber, isHide)

  // Remember an instance of the DetailProgressBar to remove elements from dom and remove listners from the integratedDataset.
  let detailProgressBar
  integratedDataset.on('dataset_displaying_detail_update_event', (selectedName, selectedDataset) => {
    if (selectedName === dataset.name) {
      detailProgressBar = creatDetailProgressBar(selectedDataset, onAnswerButtonClick)
      dom.appendChild(detailProgressBar.dom)
    } else {
      if (detailProgressBar && detailProgressBar.dom.parentElement) {
        detailProgressBar.dispose()
        dom.removeChild(detailProgressBar.dom)
      }
    }
  })
}

function creatDetailProgressBar(selectedDataset, onAnswerButtonClick) {
  const detailProgressBar = new DetailProgressBar(selectedDataset, onAnswerButtonClick)
  return detailProgressBar
}
