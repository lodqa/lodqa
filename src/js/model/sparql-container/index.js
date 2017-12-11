module.exports = class {
  constructor(loader) {
    this._datasets = new Map()

    loader.on('solutions', ({
      dataset,
      anchored_pgp,
      query
    }) => {
      if (!this._datasets.has(dataset)) {
        this._datasets.set(dataset, [])
      }
      this._datasets.get(dataset)
        .push({
          anchoredPgp: anchored_pgp,
          sparql: query.sparql
        })
    })

    loader.on('solutions', ({
      dataset,
      query,
      solutions
    }) => {
      this._datasets.get(dataset)
        .filter((sparql) => sparql.sparql === query.sparql)
        .forEach((sparql) => sparql.solutions = {
          bgp: query.bgp,
          solutions: solutions
        })
    })
  }

  getSparql(dataset, sparqlNumber) {
    return this._datasets.get(dataset)[sparqlNumber - 1]
  }
}
