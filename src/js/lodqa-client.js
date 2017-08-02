const Loader = require('./loader/load-solution')
const BindResult = require('./controller/bind-result')
const bindProgressPresentation = require('./controller/bind-progress-presentation')
const bindParseRenderingPresentation = require('./controller/bind-parse-rendering-presentation')
const bindSearchButton = require('./controller/bind-search-button')
const bindStopSearchButton = require('./controller/bind-stop-search-button')
const anchoredPgpTablePresentation = require('./presentation/anchored-pgp-table-Presentation')
const answersPresentation = require('./presentation/answers-presentation')
const sparqlPresentation = require('./presentation/sparql-presentation')
const LabelFinder = require('./label-finder')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const bindResult = new BindResult(loader, 'lodqa-results')
  const labelFinder = new LabelFinder(answersPresentation)

  bindResult({
    sparqlCount: [
      sparqlPresentation.setSparqlCount
    ],
    anchoredPgp: [
      anchoredPgpTablePresentation.onAnchoredPgp,
      answersPresentation.onAnchoredPgp,
      labelFinder.onAnchoredPgp
    ],
    solution: [
      sparqlPresentation.onSolution,
      answersPresentation.onSolution,
      (domId, data) => labelFinder.onSolution(data)
    ]
  })

  bindProgressPresentation(loader)
  bindParseRenderingPresentation(loader)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => sparqlPresentation.setVerbose(event.target.checked))
}
