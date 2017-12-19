const AnswerSummary = require('../../model/answer-summary')
const AnswerFilter = require('../../model/answer-filter')
const Pagination = require('../../model/pagenation')
const AnswerSummaryPresentation = require('../../presentation/answer-summary-presentation')
const DownloadButtonPresentation = require('../../presentation/download-button-presentation')
const PaginationPresentation = require('../../presentation/pagination-presentation')

module.exports = function(loader) {
  const answerSummary = new AnswerSummary(loader)
  const answerFilter = new AnswerFilter(answerSummary)
  const pagination = new Pagination(answerFilter)
  new AnswerSummaryPresentation(document.querySelector('.answer-summary'), pagination)
  new DownloadButtonPresentation(document.querySelector('.download-buttons'), answerFilter)
  new PaginationPresentation(document.querySelector('.answer-summary-pages'), pagination)

  return answerFilter
}
