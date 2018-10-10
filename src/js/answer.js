const AnswerLoader = require('./loader/answer-loader')
const createModelsAndBindItToLoader = require('./controller/answer/create-models-and-bind-it-to-loader')
const bindUserEvents = require('./controller/answer/bind-user-events')
const start = require('./controller/answer/start')

;
(() => {
  const loader = new AnswerLoader()

  // Create models and bind them to the presentations.
  const {
    answerSummary,
    mediaSelect,
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer,
    sparqlInformatianContainer
  } = createModelsAndBindItToLoader(loader)

  // Bind user's events.
  bindUserEvents(answerSummary, mediaSelect, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformatianContainer)

  start(loader)
})()
