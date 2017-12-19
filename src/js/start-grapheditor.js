const Loader = require('./loader')
const SparqlProgress = require('./model/sparql-progress')
const Dataset = require('./model/dataset')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const createPresentations = require('./grapheditor/create-presentations')
const getEndpointInformationFromDom = require('./grapheditor/get-endpoint-information-from-dom')
const createSimplpProgressBarOnSparqlReset = require('./controller/start-grapheditor/show-simple-progress-bar-on-sparql-reset')
const DetailProgressBar = require('./presentation/detail-progress-bar-presentation')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const dataset = new Dataset('static', loader, getEndpointInformationFromDom())
  const sparqlProgress = new SparqlProgress(dataset)

  createPresentations(dataset, {
    resultSelector: '#lodqa-results',
    progressSelector: '#lodqa-messages'
  })

  createSimplpProgressBarOnSparqlReset(document.querySelector('.progress-bar__simple-progress-bar'), sparqlProgress)
  new DetailProgressBar(document.querySelector('.detail-progress-bar'), sparqlProgress)

  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => dataset.isVerbose = event.target.checked)

  dataset.on('error', () => console.error(dataset.errorMessage))
}
