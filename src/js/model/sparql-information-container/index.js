const setSparql = require('./set-sparql')
const getSparql = require('./get-sparql')

module.exports = class {
  constructor(loader) {
    this._datasets = new Map()

    loader.on('sparql', ({
      dataset,
      anchored_pgp,
      sparql
    }) => setSparql(this._datasets, dataset.name, sparql, anchored_pgp))

    loader.on('solutions', ({
      dataset,
      anchored_pgp,
      bgp,
      sparql,
      solutions,
      error
    }) => {
      const s = getSparql(this._datasets, dataset.name, sparql, anchored_pgp)
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
      const s = getSparql(this._datasets, dataset.name, sparql)
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
    return getSparql(this._datasets, dataset, {
      number: Number(sparqlNumber)
    })
  }
}
