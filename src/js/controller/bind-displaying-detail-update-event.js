const DetailProgressBar = require('../presentation/detail-progress-bar-presentation')

module.exports = function(dom, integratedDataset, dataset) {
  // Remember an instance of the DetailProgressBar to remove elements from dom and remove listners from the integratedDataset.
  let detailProgressBar
  integratedDataset.on('dataset_displaying_detail_update_event', (selectedName, selectedDataset) => {
    if (selectedName === dataset.name) {
      detailProgressBar = creatDetailProgressBar(selectedDataset)
      dom.appendChild(detailProgressBar.dom)
    } else {
      if (detailProgressBar && detailProgressBar.dom.parentElement) {
        detailProgressBar.dispose()
        dom.removeChild(detailProgressBar.dom)
      }
    }
  })
}

function creatDetailProgressBar(selectedDataset) {
  const detailProgressBar = new DetailProgressBar(selectedDataset)
  return detailProgressBar
}
