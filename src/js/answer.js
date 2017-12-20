const LoaderForAnswer = require('./loader/loader-for-answer')
const createModelsAndBindItToLoader = require('./controller/answer/create-models-and-bind-it-to-loader')
const bindUserEvents = require('./controller/answer/bind-user-events')
const start = require('./controller/answer/start')

;
(() => {
  const loader = new LoaderForAnswer()

  // Create models and bind them to the presentations.
  const {
    answerSummary,
    summaryProgress,
    datasetsProgress,
    filterSparqlWithAnswer,
    sparqlInformatianContainer
  } = createModelsAndBindItToLoader(loader)

  // Bind user's events.
  bindUserEvents(answerSummary, summaryProgress, datasetsProgress, filterSparqlWithAnswer, sparqlInformatianContainer)

  start(loader)
})()
