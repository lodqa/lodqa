const getUniqAnswers = require('../get-uniq-answers')

module.exports = class {
  constructor(name) {
    this.name = name

    this._sparqls = new Set()
    this._sparqls_in_progress = new Set()
    this._sparqls_done = new Set()

    this._solutions = []

    this.max = 0
    this.value = 0
    this.show = false
  }

  addSparql(sparql) {
    this._sparqls.add(sparql)
    this.max = this._sparqls.size
  }

  startSparql(sparql) {
    this._sparqls_in_progress.add(sparql.number)
  }

  finishSparql(error, anchoredPgp, sparql, solutions) {
    this._sparqls_done.add(sparql.number)
    this.value = this._sparqls_done.size

    this._solutions.push({
      sparql,
      error,
      answers: getUniqAnswers(solutions, anchoredPgp.focus),
      visible: true
    })
  }

  hideSparql(sparqlNumber, visible) {
    findSparql(this._solutions, Number(sparqlNumber)).visible = visible
  }

  get percentage() {
    return Math.floor(this._sparqls_done.size / this._sparqls.size * 1000) / 10
  }

  get snapshot() {
    const ret = []
    for (const sparql of this._sparqls.values()) {
      if (this._sparqls_done.has(sparql.number)) {
        // The sparql was queried already!
        if (findSparql(this._solutions, sparql.number)) {
          const s = findSparql(this._solutions, sparql.number)
          ret.push({
            hasSolution: true,
            uniqAnswersLength: s.answers.length,
            visible: s.visible,
            error: s.error
          })
        } else {
          console.assert(false, 'All completed sparqs SHOULD have solutions.')
        }
      } else if (this._sparqls_in_progress.has(sparql.number)) {
        // The sparql is searching now.
        ret.push({
          hasSolution: false,
          isProgress: true
        })
      } else {
        // The sparql is not queried yet.
        ret.push({
          hasSolution: false
        })
      }
    }

    return ret.map((s, index) => Object.assign(s, {
      datasetName: this.name,
      sparqlNumber: index + 1,
      sparqlName: index + 1,
    }))
  }
}

function findSparql(solutions, sparqlNumber) {
  return solutions.find((s) => s.sparql.number === sparqlNumber)
}
