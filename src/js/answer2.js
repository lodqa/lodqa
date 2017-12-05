const AnswerSummary = require('./model/answer-summary')
const AnswerSummaryPresentation = require('./presentation/answer-summary-presentation')
const SummaryProgress = require('./model/summary-progress')
const SummaryProgressPresentation = require('./presentation/summary-progressbar-presentation')
const LoaderForAnswer2 = require('./loader/loader-for-answer2')

;
(() => {
  const loader = new LoaderForAnswer2()
  const answerSummary = new AnswerSummary(loader)
  new AnswerSummaryPresentation(document.querySelector('.answer-summary'), answerSummary)
  const summaryProgress = new SummaryProgress(loader)
  new SummaryProgressPresentation(document.querySelector('.summary-progress'), summaryProgress)

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
