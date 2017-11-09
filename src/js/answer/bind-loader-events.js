const bindEvents = require('../controller/bind-events')
const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')
const ProgressBarPresentation = require('../presentation/progress-bar-presentation')

module.exports = function bindLoaderEvents(loader, model, parent, name, selectors) {
  const answerIndexPresentation = new AnswerIndexPresentation(parent.querySelector(selectors.answerIndexDomSelector))
  const downloadJsonButton = new DownloadButton(parent.querySelector(selectors.downloadJsonButtonSelector), (button) => button.updateContent(model.labelAndUrls))
  const downloadTsvButton = new DownloadTsvButton(parent.querySelector(selectors.downloadTsvButtonSelector), (button) => button.updateContent(model.labelAndUrls))
  const progressBarPresentation = new ProgressBarPresentation(parent.querySelector(selectors.progressBarSelector), name)

  bindEvents(model, {
    'sparql_reset_event': [(sparqls) =>  progressBarPresentation.show(
      sparqls,
      (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
    )],
    'solution_add_event': [
      () => progressBarPresentation.progress(model.currentSolution.solutions, model.sparqlCount, model.focus, model.currentSolution.sparql_timeout)
    ],
    'answer_index_add_event': [
      () => answerIndexPresentation.updateDisplay(model.answerIndex),
      () => downloadJsonButton.updateLength(model.answerIndex.length),
      () => downloadTsvButton.updateLength(model.answerIndex.length)
    ],
    'answer_index_update_event': [
      () => answerIndexPresentation.updateDisplay(model.answerIndex)
    ],
    'label_update_event': [
      () => answerIndexPresentation.updateDisplay(model.answerIndex)
    ]
  })

  bindEvents(loader, {
    error: [
      (data) => progressBarPresentation.stop(model.sparqlCount, data),
      (data) => console.error(data)
    ],
    ws_close: [
      () => progressBarPresentation.stop(model.sparqlCount)
    ]
  })
}
