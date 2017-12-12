module.exports = function(parent, handler) {
  parent.addEventListener('click', ({
    target
  }) => {
    if (target.dataset.datasetName && target.dataset.sparqlNumber) {
      handler(target.dataset.datasetName, target.dataset.sparqlNumber)
    }
  })
}
