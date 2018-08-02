const {
  EventEmitter
} = require('events')
const AnswerContainer = require('./answer-container')

module.exports = class extends EventEmitter {
  constructor(loader) {
    super()

    this._answerContainer = new AnswerContainer()

    loader.on('answer', ({
      dataset,
      anchored_pgp,
      sparql,
      answer
    }) => this._addAnswer(dataset, anchored_pgp, sparql, answer))
  }

  _addAnswer(dataset, anchored_pgp, sparql, answer) {
    this._answerContainer.addAnswer(answer, dataset.name, dataset.number, sparql.number)
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
