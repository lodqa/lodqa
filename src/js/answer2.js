const LoaderForAnswer2 = require('./loader/loader-for-answer2')
const createModelsAndBindItToLoader = require('./answer2/create-models-and-bind-it-to-loader')
const bindUserEvents = require('./answer2/bind-user-events')
const start = require('./answer2/start')

;
(() => {
  const loader = new LoaderForAnswer2()

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
