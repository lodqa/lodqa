module.exports = function(dom, sparqlCount) {
  return dom.querySelector(`.progress-bar__detail-progress-bar [data-sparql-number="${sparqlCount}"]`)
}
