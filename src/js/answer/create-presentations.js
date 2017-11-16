const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')

module.exports = function(dataset, parent, {
  answerIndexDomSelector,
  downloadJsonButtonSelector,
  downloadTsvButtonSelector
}) {
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
}
