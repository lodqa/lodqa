const SparqlCount = require('./sparql-count')
const getUniqAnswers = require('../answer/get-uniq-answers')
const addAnswersOfSparql = require('./add-answers-of-sparql')
const findLabel = require('../find-label')

module.exports = class Model {
  constructor() {
    this._sparqls = null
    this._sparqlCount = new SparqlCount()
    this._anchoredPgp = null
    this._solution = new Map()

    // The answers is a map that has url as key and answer as value.
    // The answer is an object that has a url, a label and an array of sparql.
    this._answersMap = new Map()

    // The set of hide sparqls. This has only spraqlCount
    this._hideSparqls = new Set()
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

  get answers() {
    const originalAnswers = Array.from(this._answersMap.values())

    // Hide answers accoding to the hidelSparqls
    const answers = originalAnswers.map((a) => Object.assign({}, a, {
      sparqls: a.sparqls.filter((sparql) => !this._hideSparqls.has(sparql.sparqlNumber.toString()))
    }))

    return answers
  }

  get currentSoluton() {
    return this.getSolution(this.sparqlCount)
      .solution
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
    return this._solution.get(sparqlCount.toString())
  }

  setSolution(solution) {
    this._solution.set(`${this.sparqlCount}`, {
      solution,
      anchoredPgp: this.anchoredPgp
    })

    const uniqAnswers = getUniqAnswers(this.currentSoluton.solutions, this.focus)

    addAnswersOfSparql(
      this._answersMap,
      uniqAnswers,
      this.sparqlCount
    )
  }

  findLabel(callback) {
    const uniqAnswers = getUniqAnswers(this.currentSoluton.solutions, this.focus)

    findLabel(uniqAnswers.map((answer) => answer.url), (url, label) => {
      this._answersMap.get(url)
        .label = label

      callback()
    })
  }

  updateSparqlHideStatus(sparqlCount, isHide) {
    if (isHide) {
      this._hideSparqls.add(sparqlCount)
    } else {
      this._hideSparqls.delete(sparqlCount)
    }
  }
}
