const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(model, parent, {
  answerIndexDomSelector,
  downloadJsonButtonSelector,
  downloadTsvButtonSelector,
  progressBarSelector
}, name) {
  new AnswerIndexPresentation(
    parent.querySelector(answerIndexDomSelector),
    model
  )
  new DownloadButton(
    parent.querySelector(downloadJsonButtonSelector),
    (button) => button.updateContent(model.labelAndUrls),
    model
  )
  new DownloadTsvButton(
    parent.querySelector(downloadTsvButtonSelector),
    (button) => button.updateContent(model.labelAndUrls),
    model
  )
  new ProgressBarPresentation(
    parent.querySelector(progressBarSelector),
    model,
    name
  )
}
