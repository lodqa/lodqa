const show = require('./show')

module.exports = function(dom, integratedDataset, dataset) {
  // Create a simpleProgressBar
  const toggleDetailProgressBar = (isShow) => integratedDataset.displayingDetail = (isShow ? dataset.name : '')
  const simpleProgressBar = show(
    dom,
    dataset.name,
    dataset.sparqlsMax,
    toggleDetailProgressBar
  )

  // Bind the Dataset's events
  const progressOnSolutionAdd = () => simpleProgressBar.progress(dataset.sparqlCount)
  dataset.on('solution_add_event', progressOnSolutionAdd)

  // Bind the Integrated Dataset's event.
  const onDatasetDisplayingDetailUpdate = (selectedName) => simpleProgressBar.checked = (selectedName === dataset.name)
  integratedDataset.on('dataset_displaying_detail_update_event', onDatasetDisplayingDetailUpdate)
}
