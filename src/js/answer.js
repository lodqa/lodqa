const OneByOneExecuteLoader = require('./loader/one-by-one-execute-loader')
const createModelsAndBindItToLoader = require('./controller/answer/create-models-and-bind-it-to-loader')
const bindUserEvents = require('./controller/answer/bind-user-events')
const start = require('./controller/answer/start')

;
(() => {
  const loader = new OneByOneExecuteLoader()

  // Create models and bind them to the presentations.
  const {
    answerSummary,
    answerMedia,
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer,
    sparqlInformatianContainer
  } = createModelsAndBindItToLoader(loader)

  // Bind user's events.
  bindUserEvents(answerSummary, answerMedia, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformatianContainer)

  start(loader)
})()
