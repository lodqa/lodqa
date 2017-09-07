module.exports = function(domId, sparqlCount) {
  return document.querySelector(`#${domId} .progress-bar__detail-progress-bar [data-sparql-number="${sparqlCount}"]`)
}
