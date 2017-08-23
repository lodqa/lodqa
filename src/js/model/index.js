const SparqlCount = require('../sparql-count')

module.exports = class Model {
  constructor() {
    this._sparqls = null
    this._sparqlCount = new SparqlCount()
    this._anchoredPgp = null
    this._solution = new Map()
  }

  set sparqls(sparqls) {
    this._sparqls = sparqls
  }

  set anchoredPgp(anchoredPgp) {
    this._anchoredPgp = anchoredPgp
  }

  get anchoredPgp() {
    return this._anchoredPgp
  }

  get focus() {
    return this._anchoredPgp.focus
  }

  get sparqlCount() {
    return this._sparqlCount.count
  }

  resetSpraqlCount() {
    this._sparqlCount.reset()
  }

  incrementSparqlCount() {
    this._sparqlCount.increment()
  }

  getSparql(sparqlCount) {
    return this._sparqls[sparqlCount - 1]
  }

  getSolution(sparqlCount) {
    return this._solution.get(sparqlCount)
  }

  setSolution(solution) {
    this._solution.set(`${this.sparqlCount}`, {
      solution,
      anchoredPgp: this.anchoredPgp
    })
  }
}
