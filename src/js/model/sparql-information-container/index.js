module.exports = class {
  constructor(loader) {
    this._datasets = new Map()

    loader.on('sparql', ({
      dataset,
      anchored_pgp,
      sparql
    }) => {
      if (!this._datasets.has(dataset)) {
        this._datasets.set(dataset, [])
      }
      this._datasets.get(dataset)
        .push({
          anchoredPgp: anchored_pgp,
          sparql
        })
    })

    loader.on('solutions', ({
      dataset,
      bgp,
      sparql,
      solutions,
      error
    }) => {
      this._datasets.get(dataset)
        .filter((s) => s.sparql === sparql)
        .forEach((s) => {
          s.solutions = {
            solutions,
            bgp
          },
          s.error = error
        })
    })

    loader.on('answer', ({
      dataset,
      sparql,
      answer,
      label
    }) => {
      this._datasets.get(dataset)
        .filter((s) => s.sparql === sparql)
        .forEach((s) => {
          if (!s.answers) {
            s.answers = []
          }
          s.answers.push({
            url: answer[1],
            label
          })
        })
    })
  }

  getSparql(dataset, sparqlNumber) {
    return this._datasets.get(dataset)[sparqlNumber - 1]
  }
}
