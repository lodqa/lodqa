const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function(model, parent, name, selectors) {
  new AnswerIndexPresentation(parent.querySelector(selectors.answerIndexDomSelector), model)
  new DownloadButton(
    parent.querySelector(selectors.downloadJsonButtonSelector),
    (button) => button.updateContent(model.labelAndUrls),
    model
  )
  new DownloadTsvButton(
    parent.querySelector(selectors.downloadTsvButtonSelector),
    (button) => button.updateContent(model.labelAndUrls),
    model
  )
  new ProgressBarPresentation(
    parent.querySelector(selectors.progressBarSelector),
    model,
    name
  )
}
