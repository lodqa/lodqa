const {
  EventEmitter
} = require('events')
const DatasetContainer = require('./dataset-container')
const AnswerContainer = require('./answer-container')
const getUniqAnswers = require('../get-uniq-answers')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._datasetContainer = new DatasetContainer()
    this._answerContainer = new AnswerContainer()

    // A Dataset with bgps will have SPARQLs
    loader.on('bgps', ({
      dataset
    }) => this._datasetContainer.addDataset(dataset))
    loader.on('sparql', ({
      dataset,
      query
    }) => this._datasetContainer.addSparql(dataset, query.sparql))
    loader.on('solutions', ({
      dataset,
      anchored_pgp,
      query,
      solutions
    }) => this._addSolutions(dataset, anchored_pgp, query.sparql, solutions))
  }

  _addSolutions(dataset, anchored_pgp, sparql, solutions) {
    const {
      datasetName,
      datasetNumber,
      sparqlNumber
    } = this._datasetContainer.getSparqlNumer(dataset, sparql)
    const answers = getUniqAnswers(solutions, anchored_pgp.focus)

    answers.forEach((answer) => this._answerContainer.addAnswer(answer, datasetName, datasetNumber, sparqlNumber))

    this.emit('answer_summary_update_event')
  }

  get snapshot() {
    return this._answerContainer.snapshot
  }
}
