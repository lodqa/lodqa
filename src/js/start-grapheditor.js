const SolutionsLoader = require('./loader/solutions-loader')
const SparqlProgress = require('./model/sparql-progress')
const Dataset = require('./model/dataset')
const bindSearchButton = require('./controller/start-grapheditor/bind-search-button')
const bindStopSearchButton = require('./controller/start-grapheditor/bind-stop-search-button')
const createPresentations = require('./controller/start-grapheditor/create-presentations')
const getEndpointInformationFromDom = require('./controller/start-grapheditor/get-endpoint-information-from-dom')
const createSparqlProgressbarOnSparqlReset = require('./controller/start-grapheditor/show-sparql-progressbar-on-sparql-reset')
const DetailProgressbar = require('./presentation/sparql-detail-progressbar-presentation')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new SolutionsLoader()
  const dataset = new Dataset(loader, getEndpointInformationFromDom())
  const sparqlProgress = new SparqlProgress(dataset)

  createPresentations(dataset, {
    resultSelector: '#lodqa-results',
    progressSelector: '#lodqa-messages'
  })

  createSparqlProgressbarOnSparqlReset(document.querySelector('.sparlq-progressbar'), sparqlProgress)
  new DetailProgressbar(document.querySelector('.detail-progressbar'), sparqlProgress)

  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => dataset.isVerbose = event.target.checked)

  dataset.on('error', () => console.error(dataset.errorMessage))
}
