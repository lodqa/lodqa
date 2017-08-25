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

  get answersMap() {
    return this._answersMap
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
      this.answersMap,
      uniqAnswers,
      this.sparqlCount
    )
  }

  findLabel(callback) {
    const uniqAnswers = getUniqAnswers(this.currentSoluton.solutions, this.focus)

    findLabel(uniqAnswers.map((answer) => answer.url), (url, label) => {
      this.answersMap.get(url)
        .label = label

      callback(this.answersMap)
    })
  }
}
