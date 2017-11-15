const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(dataset, parent, {
  answerIndexDomSelector,
  downloadJsonButtonSelector,
  downloadTsvButtonSelector,
  progressBarSelector
}, name) {
  new AnswerIndexPresentation(
    parent.querySelector(answerIndexDomSelector),
    dataset
  )
  new DownloadButton(
    parent.querySelector(downloadJsonButtonSelector),
    (button) => button.updateContent(dataset.labelAndUrls),
    dataset
  )
  new DownloadTsvButton(
    parent.querySelector(downloadTsvButtonSelector),
    (button) => button.updateContent(dataset.labelAndUrls),
    dataset
  )
  new ProgressBarPresentation(
    parent.querySelector(progressBarSelector),
    dataset,
    name
  )
}
