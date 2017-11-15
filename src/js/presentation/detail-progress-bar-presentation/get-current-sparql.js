module.exports = function(dom, sparqlCount) {
  return dom.querySelector(`.progress-bar__detail-progress-bar__sparqls__sparql[data-sparql-number="${sparqlCount}"]`)
}
