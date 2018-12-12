const setSparql = require('./set-sparql')
const appendAnswers = require('./append-answers')
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
      // Supports out-of-order events
      setSparql(this._datasets, dataset.name, sparql, anchored_pgp, {
        solutions: {
          solutions,
          bgp
        },
        error: error
      })
    })

    loader.on('answer', ({
      dataset,
      anchored_pgp,
      bgp,
      sparql,
      solutions,
      error,
      answer,
      label
    }) => {
      // Supports out-of-order events
      appendAnswers(this._datasets, dataset.name, sparql, anchored_pgp, {
        solutions: {
          solutions,
          bgp
        },
        error: error
      }, [{
        url: answer[1],
        label
      }])
    })
  }

  getSparql(dataset, sparqlNumber) {
    return getSparql(this._datasets, dataset, {
      number: Number(sparqlNumber)
    })
  }
}
