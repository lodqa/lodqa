const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const SparqlCount = require('./sparql-count')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const SparqlAndAnswersPresentation = require('./presentation/sparql-and-answers-presentation')
const AnswerIndexPresentation = require('./presentation/answer-index-presentation')
const beginSearch = require('./execute/begin-search')
const bindOneKeyupHandler = require('./execute/bind-one-keyup-handler')
const bindCheckboxToToggleShowOnlyHasAnswers = require('./execute/bind-checkbox-to-toggle-show-only-has-answers')
const doIfEsc = require('./execute/do-if-esc')
const bindSparqlLinkClick = require('./execute/bind-sparql-link-click')

const loader = new Loader()
const bindResult = new BindResult(loader.eventEmitter)
const progressBarPresentation = new ProgressBarPresentation('progress-bar')
const answerIndexPresentation = new AnswerIndexPresentation('answer-index')

const sparqlCount = new SparqlCount()
let anchoredPgp = null
const solution = new Map()

const stopSearchIfEsc = doIfEsc(() => loader.stopSearch())
const sparqlAndAnswersPresentation = new SparqlAndAnswersPresentation('lightbox', () => bindOneKeyupHandler(stopSearchIfEsc))
let sparqls = null

bindSparqlLinkClick(['progress-bar', 'answer-index'], (sparqlCount) => sparqlAndAnswersPresentation.show(sparqlCount, sparqls[sparqlCount - 1], solution.get(sparqlCount)))

bindResult({
  sparqls: [
    () => sparqlCount.reset(),
    (newSparqls) => sparqls = newSparqls,
    (sparqls) => progressBarPresentation.show(
      sparqls,
      (sparqlCount, isHide) => answerIndexPresentation.updateSparqlHideStatus(sparqlCount, isHide)
    )
  ],
  anchored_pgp: [
    (data) => anchoredPgp = data
  ],
  solution: [
    () => sparqlCount.increment(),
    (data) => solution.set(`${sparqlCount.count}`, {solution: data, anchoredPgp}),
    (data) => answerIndexPresentation.progress(data, sparqlCount.count, anchoredPgp.focus),
    (data) => progressBarPresentation.progress(data.solutions, sparqlCount.count, anchoredPgp.focus, data.sparql_timeout)
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
bindOneKeyupHandler(stopSearchIfEsc)
bindCheckboxToToggleShowOnlyHasAnswers('show-only-has-answers', progressBarPresentation)
