const AnswerSummary = require('../../../model/answer-summary')
const AnswerFilter = require('../../../model/answer-filter')
const Pagination = require('../../../model/pagenation')
const MediaSelect = require('../../../model/media-select')
const AnswerMedia = require('../../../model/answer-media')
const AnswerSummaryPresentation = require('../../../presentation/answer-summary-presentation')
const DownloadAnswersPresentation = require('../../../presentation/download-answers-presentation')
const PaginationPresentation = require('../../../presentation/pagination-presentation')
const AnswerMediaPresentation = require('../../../presentation/answer-media-presentation')

module.exports = function(loader) {
  const answerSummary = new AnswerSummary(loader)
  const answerFilter = new AnswerFilter(answerSummary)
  const pagination = new Pagination(answerFilter)
  const mediaSelect = new MediaSelect(pagination)
  const answerMedia = new AnswerMedia(mediaSelect)

  new AnswerSummaryPresentation(document.querySelector('.answer-summary'), mediaSelect)
  new DownloadAnswersPresentation(document.querySelector('.download-answers'), answerFilter)
  new PaginationPresentation(document.querySelector('.answer-summary-pages'), pagination)
  new AnswerMediaPresentation(document.querySelector('.answer-media'), answerMedia)

  return [answerFilter, mediaSelect]
}
