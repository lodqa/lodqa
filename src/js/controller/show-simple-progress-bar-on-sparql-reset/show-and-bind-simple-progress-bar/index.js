const show = require('./show')

module.exports = function showAndBindSimpleProgeressBar(dom, integratedDataset, datasetName, dataset) {
  // Create a simpleProgressBar
  const toggleDetailProgressBar = (isShow) => integratedDataset.displayingDetail = (isShow ? datasetName : '')
  const simpleProgressBar = show(
    dom,
    datasetName,
    dataset.sparqlsMax,
    toggleDetailProgressBar
  )

  // Bind the Dataset's events
  const progressOnSolutionAdd = () => simpleProgressBar.progress(dataset.sparqlCount)
  dataset.on('solution_add_event', progressOnSolutionAdd)

  // Bind the Integrated Dataset's event.
  const onDatasetDisplayingDetailUpdate = (selectedName) => simpleProgressBar.checked = (selectedName === datasetName)
  integratedDataset.on('dataset_displaying_detail_update_event', onDatasetDisplayingDetailUpdate)
}
