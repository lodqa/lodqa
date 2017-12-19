module.exports = class {
  constructor(loader) {
    this._datasets = new Map()

    loader.on('sparql', ({
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
      solutions,
      error
    }) => {
      this._datasets.get(dataset)
        .filter((sparql) => sparql.sparql === query.sparql)
        .forEach((sparql) => {
          sparql.solutions = {
            solutions,
            bgp: query.bgp
          },
          sparql.error = error
          sparql.answers = []
        })
    })

    loader.on('answer', ({
      dataset,
      query,
      answer,
      label
    }) => {
      this._datasets.get(dataset)
        .filter((sparql) => sparql.sparql === query.sparql)
        .forEach((sparql) => sparql.answers.push({
          url: answer[1],
          label: label
        }))
    })
  }

  getSparql(dataset, sparqlNumber) {
    return this._datasets.get(dataset)[sparqlNumber - 1]
  }
}
