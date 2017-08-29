module.exports = function(domId, sparqlCount) {
  return document.querySelector(`#${domId} .detail-progress-bar [data-sparql-number="${sparqlCount}"]`)
}
