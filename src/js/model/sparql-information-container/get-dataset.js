module.exports = function(datasets, datasetName) {
  // Supports out-of-order events
  if (!datasets.has(datasetName)) {
    datasets.set(datasetName, new Map())
  }
  return datasets.get(datasetName)
}
