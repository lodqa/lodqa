module.exports = class {
  constructor(loader) {
    this._datasets = new Map()

    loader.on('sparql', ({
      dataset,
      anchored_pgp,
      sparql
    }) => {
      if (!this._datasets.has(dataset.name)) {
        this._datasets.set(dataset.name, new Map())
      }
      setSparql(this._datasets, dataset.name, sparql, anchored_pgp)
    })

    loader.on('solutions', ({
      dataset,
      bgp,
      sparql,
      solutions,
      error
    }) => {
      const s = getSparql(this._datasets, dataset.name, sparql.number)
      Object.assign(
        s, {
          solutions: {
            solutions,
            bgp
          },
          error: error
        })
    })

    loader.on('answer', ({
      dataset,
      sparql,
      answer,
      label
    }) => {
      const s = getSparql(this._datasets, dataset.name, sparql.number)
      Object.assign(
        s, {
          answers: (s.answers || [])
            .concat([{
              url: answer[1],
              label
            }])
        })
    })
  }

  getSparql(dataset, sparqlNumber) {
    return getSparql(this._datasets, dataset, Number(sparqlNumber))
  }
}

function setSparql(datasets, dataset, sparql, anchored_pgp) {
  return datasets
    .get(dataset)
    .set(sparql.number, {
      anchoredPgp: anchored_pgp,
      sparql: sparql.query
    })
}

function getSparql(datasets, dataset, sparqlNumber) {
  return datasets
    .get(dataset)
    .get(sparqlNumber)
}
