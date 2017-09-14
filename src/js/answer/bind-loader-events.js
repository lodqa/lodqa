const BindResult = require('../controller/bind-result')
const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadButton = require('../presentation/download-button')
const DownloadTsvButton = require('../presentation/download-tsv-button')

module.exports = function bindLoaderEvents(loader, model, progressBarPresentation, answerIndexDomId) {
  const bindResult = new BindResult(loader.eventEmitter)
  const answerIndexPresentation = new AnswerIndexPresentation(answerIndexDomId)
  const downloadJsonButton = new DownloadButton('download-json-button', (button) => button.updateContent(model.labelAndUrls), (data) => JSON.stringify(data, null, 2))
  const downloadTsvButton = new DownloadTsvButton('download-tsv-button', (button) => button.updateContent(model.labelAndUrls))

  model.onAnswerChange = () => answerIndexPresentation.updateDisplay(model)
  model.onAnswerChange = () => downloadJsonButton.updateLength(model.answers.length)
  model.onAnswerChange = () => downloadTsvButton.updateLength(model.answers.length)

  bindResult({
    sparqls: [
      (newSparqls) => model.sparqls = newSparqls,
      () => model.resetSpraqlCount(),
      (sparqls) => progressBarPresentation.show(
        sparqls,
        (sparqlCount, isHide) => model.updateSparqlHideStatus(sparqlCount, isHide)
      )
    ],
    anchored_pgp: [
      (data) => model.anchoredPgp = data
    ],
    solution: [
      () => model.incrementSparqlCount(),
      (data) => model.setSolution(data),
      () => model.findLabel(),
      (data) => progressBarPresentation.progress(data.solutions, model.sparqlCount, model.focus, data.sparql_timeout)
    ],
    error: [
      (data) => progressBarPresentation.stop(model.sparqlCount, data),
      (data) => console.error(data)
    ],
    ws_close: [
      () => progressBarPresentation.stop(model.sparqlCount)
    ]
  })
}
