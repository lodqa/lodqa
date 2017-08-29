const BindResult = require('../controller/bind-result')
const AnswerIndexPresentation = require('../presentation/answer-index-presentation')
const DownloadJsonButton = require('../presentation/download-json-button')

module.exports = function bindLoaderEvents(loader, model, progressBarPresentation, answerIndexDomId) {
  const bindResult = new BindResult(loader.eventEmitter)
  const answerIndexPresentation = new AnswerIndexPresentation(answerIndexDomId)

  new DownloadJsonButton('download-json-button', (button) => {
    button.content = encodeURIComponent(JSON.stringify(model.answers.map((s) => ({
      label: s.label,
      url: s.url
    })), null, 2))
  })

  model.onAnswerChange = () => answerIndexPresentation.updateDisplay(model)

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
      () => answerIndexPresentation.progress(model),
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
