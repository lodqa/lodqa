const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const SparqlCount = require('./sparql-count')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const SparqlAndAnswersPresentation = require('./presentation/sparql-and-answers-presentation')
const AnswerIndexPresentation = require('./presentation/answer-index-presentation')
const beginSearch = require('./execute/begin-search')
const bindEscKeyToStopSearch = require('./execute/bind-esc-key-to-stop-search')
const bindCheckboxToToggleShowOnlyHasAnswers = require('./execute/bind-checkbox-to-toggle-show-only-has-answers')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter)
const sparqlCount = new SparqlCount()
let anchoredPgp = null
const solution = new Map()
const progressBarPresentation = new ProgressBarPresentation('progress-bar')
const sparqlAndAnswersPresentation = new SparqlAndAnswersPresentation('lightbox')
const answerIndexPresentation = new AnswerIndexPresentation('answer-index')

bindResult({
  sparql_count: [
    () => sparqlCount.reset(),
    (total) => progressBarPresentation.show(
      total,
      (sparqlCount) => sparqlAndAnswersPresentation.show(sparqlCount, anchoredPgp, solution.get(sparqlCount)),
      (sparqlCount, isHide) => answerIndexPresentation.updateSparqlHideStatus(sparqlCount, isHide)
    )
  ],
  anchored_pgp: [
    (data) => anchoredPgp = data
  ],
  solution: [
    () => sparqlCount.increment(),
    (data) => solution.set(`${sparqlCount.count}`, data),
    (data) => answerIndexPresentation.show(data, sparqlCount.count, anchoredPgp.focus),
    (data) => progressBarPresentation.progress(data.solutions, sparqlCount.count, anchoredPgp.focus)
  ],
  error: [
    (data) => progressBarPresentation.stop(sparqlCount.count, data),
    (data) => console.error(data)
  ],
  ws_close: [
    () => progressBarPresentation.stop(sparqlCount.count)
  ]
})

beginSearch(loader, 'pgp', 'mappings', 'target')
bindEscKeyToStopSearch(loader)
bindCheckboxToToggleShowOnlyHasAnswers('show-only-has-answers', progressBarPresentation)
