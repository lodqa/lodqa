const BindResult = require('../controller/bind-result')
const AnswerIndexPresentation = require('../presentation/answer-index-presentation')

module.exports = function bindLoaderEvents(loader, model, progressBarPresentation, answerIndexDomId){
  const bindResult = new BindResult(loader.eventEmitter)
  const answerIndexPresentation = new AnswerIndexPresentation(answerIndexDomId)

  bindResult({
    sparqls: [
      (newSparqls) => model.sparqls = newSparqls,
      () => model.resetSpraqlCount(),
      (sparqls) => progressBarPresentation.show(
        sparqls,
        (sparqlCount, isHide) => answerIndexPresentation.updateSparqlHideStatus(sparqlCount, isHide)
      )
    ],
    anchored_pgp: [
      (data) => model.anchoredPgp = data
    ],
    solution: [
      () => model.incrementSparqlCount(),
      (data) => model.setSolution(data),
      (data) => answerIndexPresentation.progress(data, model.sparqlCount, model.focus),
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
