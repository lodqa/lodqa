const getUniqAnswers = require('../get-uniq-answers')

module.exports = class {
  constructor(name) {
    this.name = name

    this._sparqls = new Set()
    this._sparqls_in_progress = new Set()
    this._sparqls_done = new Map()

    this.max = 0
    this.value = 0
    this.show = false
  }

  addSparql(sparql) {
    this._sparqls.add(sparql.number)
    this.max = this._sparqls.size
  }

  startSparql(sparql) {
    // Supports out-of-order events
    this.addSparql(sparql)

    this._sparqls_in_progress.add(sparql.number)
  }

  finishSparql(error, anchoredPgp, sparql, solutions) {
    // Supports out-of-order events
    this.addSparql(sparql)

    this._sparqls_done.set(sparql.number, {
      sparql,
      error,
      answers: getUniqAnswers(solutions, anchoredPgp.focus),
      visible: true
    })
    this.value = this._sparqls_done.size
  }

  toggleAnswerVisibility(sparqlNumber, visible) {
    this._sparqls_done.get(Number(sparqlNumber))
      .visible = visible
  }

  get percentage() {
    return Math.floor(this._sparqls_done.size / this._sparqls.size * 1000) / 10
  }

  get snapshot() {
    const ret = []
    for (const sparqlNumber of this._sparqls.values()) {
      if (this._sparqls_done.has(sparqlNumber)) {
        // The sparql was queried already!
        const s = this._sparqls_done.get(sparqlNumber)
        ret.push({
          sparqlNumber,
          hasSolution: true,
          uniqAnswersLength: s.answers.length,
          visible: s.visible,
          error: s.error
        })
      } else if (this._sparqls_in_progress.has(sparqlNumber)) {
        // The sparql is searching now.
        ret.push({
          sparqlNumber,
          hasSolution: false,
          isProgress: true
        })
      } else {
        // The sparql is not queried yet.
        ret.push({
          sparqlNumber,
          hasSolution: false
        })
      }
    }

    return ret.map((s) => Object.assign(s, {
      datasetName: this.name,
      sparqlName: s.sparqlNumber,
    }))
  }
}
