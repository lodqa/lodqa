const AnswerSummary = require('./model/answer-summary')
const AnswerFilter = require('./model/answer-filter')
const Pagination = require('./model/pagenation')
const AnswerSummaryPresentation = require('./presentation/answer-summary-presentation')
const PaginationPresentation = require('./presentation/pagination-presentation')
const SummaryProgress = require('./model/summary-progress')
const SummaryProgressbarPresentation = require('./presentation/summary-progressbar-presentation')
const DatasetsProgress = require('./model/datasets-progress')
const DatasetsProgressbarPresentation = require('./presentation/datasets-progressbar-presentation')
const SparqlFilter = require('./model/sparql-filter')
const DetailProgressbarPresentation = require('./presentation/detail-progressbar-presentation')
const LoaderForAnswer2 = require('./loader/loader-for-answer2')
const SparqlContainer = require('./model/sparql-container')
const bindHandlerToShowSparql = require('./answer2/bind-handler-to-show-sparql')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

;
(() => {
  const loader = new LoaderForAnswer2()

  // Create models and bind them to the presentations.
  const answerSummary = new AnswerSummary(loader)
  const answerFilter = new AnswerFilter(answerSummary)
  const pagination = new Pagination(answerFilter)
  new AnswerSummaryPresentation(document.querySelector('.answer-summary'), pagination)
  new PaginationPresentation(document.querySelector('.answer-summary-pages'), pagination)

  const datasetsProgress = new DatasetsProgress(loader)
  const summaryProgress = new SummaryProgress(loader, datasetsProgress)
  new SummaryProgressbarPresentation(document.querySelector('.summary-progressbar'), summaryProgress)
  new DatasetsProgressbarPresentation(document.querySelector('.datasets-progressbar'), datasetsProgress)
  const sparqlFilter = new SparqlFilter(datasetsProgress)
  new DetailProgressbarPresentation(document.querySelector('.detail-progressbar'), sparqlFilter)

  // Bind user's events.
  document.addEventListener('change', ({
    target
  }) => {
    if (target.closest('.summary-progressbar__checkbox')) {
      summaryProgress.showDatasets(target.checked)
    }

    if (target.closest('.datasets-progressbar__checkbox')) {
      datasetsProgress.showDataset(target.dataset.name, target.checked)
    }

    if (target.closest('.show-only-has-answers')) {
      sparqlFilter.showOnlyWithAnswer = target.checked
    }

    if (target.closest('.detail-progress-bar__sparqls__sparql__selected-answers-checkbox')) {
      answerFilter.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
      datasetsProgress.hideSparql(target.dataset.datasetName, target.dataset.sparqlNumber, target.checked)
    }
  })
  const sparqlContainer = new SparqlContainer(loader)
  bindHandlerToShowSparql(document, 'lightbox', sparqlContainer)
  bindModeButtonEventhandler('grapheditor')

  start(loader)
})()

function start(loader) {
  const pathname = '/answer3'
  const url = new URLSearchParams(window.location.search)
  const query = url.get('query') || ''
  const target = url.get('target') || ''
  const readTimeout = url.get('read_timeout') || ''
  loader.begin(pathname, query, target, readTimeout)
}
