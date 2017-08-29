module.exports = function(progressBarDomId, sparqlCount) {
  const current = document.querySelector(`#${progressBarDomId} .simple-progress-bar [data-sparql-number="${sparqlCount}"]`)
  current.innerHTML = '.'

  const next = current.nextElementSibling
  if (next) {
    next.innerHTML = 'i'
  }
}
