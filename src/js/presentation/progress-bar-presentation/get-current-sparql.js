module.exports = function(domId, sparqlCount) {
  return document.querySelector(`#${domId} [data-sparql-number="${sparqlCount}"]`)
}
