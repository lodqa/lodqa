const bindResult = require('../controller/bind-result')
const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function bindLoaderEvents(loader, model, parent, name, selectors) {
  const answerIndexPresentation = new AnswerIndexPresentation(parent.querySelector(selectors.answerIndexDomSelector))
  const downloadJsonButton = new DownloadButton(parent.querySelector(selectors.downloadJsonButtonSelector), (button) => button.updateContent(model.labelAndUrls))
  const downloadTsvButton = new DownloadTsvButton(parent.querySelector(selectors.downloadTsvButtonSelector), (button) => button.updateContent(model.labelAndUrls))
  const progressBarPresentation = new ProgressBarPresentation(parent.querySelector(selectors.progressBarSelector), name)

  model.on('sparql_reset_event', (sparqls) =>  progressBarPresentation.show(
    sparqls,
    (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
  ))
  model.on('solution_add_event', () => progressBarPresentation.progress(model.currentSolution.solutions, model.sparqlCount, model.focus, model.currentSolution.sparql_timeout))
  model.on('answer_index_add_event', () => answerIndexPresentation.updateDisplay(model.answerIndex))
  model.on('answer_index_add_event', () => downloadJsonButton.updateLength(model.answerIndex.length))
  model.on('answer_index_add_event', () => downloadTsvButton.updateLength(model.answerIndex.length))
  model.on('answer_index_update_event', () => answerIndexPresentation.updateDisplay(model.answerIndex))
  model.on('label_update_event', () => answerIndexPresentation.updateDisplay(model.answerIndex))

  bindResult(loader, {
    error: [
      (data) => progressBarPresentation.stop(model.sparqlCount, data),
      (data) => console.error(data)
    ],
    ws_close: [
      () => progressBarPresentation.stop(model.sparqlCount)
    ]
  })
}
