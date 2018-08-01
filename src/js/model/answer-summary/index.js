const {
  EventEmitter
} = require('events')
const DatasetContainer = require('./dataset-container')
const AnswerContainer = require('./answer-container')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._datasetContainer = new DatasetContainer()
    this._answerContainer = new AnswerContainer()

    // A Dataset with bgp will have SPARQLs
    loader.on('sparql', ({
      dataset,
      sparql
    }) => {
      this._datasetContainer.addDataset(dataset)
      this._datasetContainer.addSparql(dataset, sparql)
    })
    loader.on('answer', ({
      dataset,
      anchored_pgp,
      sparql,
      answer
    }) => this._addAnswer(dataset, anchored_pgp, sparql, answer))
  }

  _addAnswer(dataset, anchored_pgp, sparql, answer) {
    const {
      datasetName,
      datasetNumber,
      sparqlNumber
    } = this._datasetContainer.getSparqlNumer(dataset, sparql)

    this._answerContainer.addAnswer(answer, datasetName, datasetNumber, sparqlNumber)
    this.emit('answer_summary_update_event')
  }

  get snapshot() {
    return this._answerContainer.snapshot.map(appendMediaPropertyToUrl)
  }
}

function appendMediaPropertyToUrl(answer) {
  if (answer.urls) {
    answer.urls = answer.urls.map(appendMediaProperty)
  }
  return answer
}

function appendMediaProperty(url) {
  if (url.rendering) {
    url[url.rendering.mime_type.split('/')[0]] = true
  }
  return url
}
