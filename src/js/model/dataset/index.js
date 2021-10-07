const {
  EventEmitter
} = require('events')
const SparqlCount = require('./sparql-count')
const getUniqAnswers = require('../get-uniq-answers')
const addAnswersOfSparql = require('./add-answers-of-sparql')
const bindModelToLoader = require('./bind-model-to-loader')
const findLabelOfAnswers = require('./find-label-of-answers')

module.exports = class Model extends EventEmitter {
  constructor(loader, findLabelOptions) {
    super()

    bindModelToLoader(loader, this)

    this._findLabelOptions = findLabelOptions
    this._sparqlsMax = 0
    this._sparqlCount = new SparqlCount()
    this._anchoredPgp = null
    this._solution = new Map()

    // The answers is a map that has url as key and answer as value.
    // The answer is an object that has a url, a label.
    this._mergedAnswers = new Map()
  }

  // SPARQL
  get sparqlCount() {
    return this._sparqlCount.count
  }

  get sparqlsMax() {
    return this._sparqlsMax
  }

  set sparqlsMax(max) {
    this._sparqlsMax = max
    this.emit('sparql_add_event')
  }

  reset() {
    this._sparqlsMax = 0
    this._sparqlCount.reset()

    this.emit('sparql_reset_event')
  }

  // AnchoerdPGP
  get anchoredPgp() {
    return this._anchoredPgp
  }

  set anchoredPgp(anchoredPgp) {
    this._anchoredPgp = anchoredPgp
    this.emit('anchored_pgp_reset_event')
  }

  // Solution
  get currentSolution() {
    return this.getSolution(this.sparqlCount)
      .solution
  }

  hasSolution(sparqlCount) {
    return this._solution.has(sparqlCount)
  }

  getSolution(sparqlCount) {
    // Return solutions with anchoredPgp to show sparql detail in the serach page.
    return this._solution.get(sparqlCount.toString())
  }

  addSolution(solution) {
    this._sparqlCount.increment()
    this._solution.set(`${this.sparqlCount}`, {
      solution,
      anchoredPgp: this.anchoredPgp
    })

    this.emit('solution_add_event')

    const uniqAnswers = getUniqAnswers(this.currentSolution.solutions, this.focus)

    addAnswersOfSparql(
      this._mergedAnswers,
      uniqAnswers
    )

    findLabelOfAnswers(uniqAnswers, this._findLabelOptions, (url, label) => _updateLabel(this, url, label))
  }

  // isVerbose
  // Show SPARQLS without answers for debugging.
  get isVerbose() {
    return this._isVerbose
  }
  set isVerbose(newValue) {
    this._isVerbose = newValue
  }

  // Others
  get focus() {
    return this._anchoredPgp.focus
  }

  get labelAndUrls() {
    return this._mergedAnswers.values()
  }

  get progress() {
    return this._progress
  }
  set progress(status) {
    this._progress = status

    this.emit('state_change_event')
  }

  get errorMessage() {
    return this._errorMessage
  }

  set errorMessage(message) {
    this._errorMessage = message
    this.emit('error')
  }
}

function _updateLabel(dataset, url, label) {
  const answer = dataset._mergedAnswers.get(url)

  if (answer.labelFound !== label) {
    answer.label = label
    dataset.emit('label_update_event')
  }
}
