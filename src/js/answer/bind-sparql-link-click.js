module.exports = function(parent, selectors, handler) {
  for (const selector of selectors) {
    parent.querySelector(`${selector}`)
      .addEventListener('click', ({target}) => {
        if (target.classList.contains('sparql-link')) {
          handler(target.dataset.datasetName, target.dataset.sparqlNumber)
        }
      })
  }
}
