const AnswerSummary = require('./model/answer-summary')
const AnswerSummaryPresentation = require('./presentation/answer-summary-presentation')
const LoaderForAnswer2 = require('./loader/loader-for-answer2')

;
(() => {
  const dom = document.querySelector('.answer-summary')
  const loader = new LoaderForAnswer2()
  const model = new AnswerSummary(loader)
  new AnswerSummaryPresentation(dom, model)

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
