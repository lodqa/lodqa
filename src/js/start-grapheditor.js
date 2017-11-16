const Loader = require('./loader')
const IntegtatenDataset = require('./model/integratedDataset')
const Dataset = require('./model/dataset')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const createPresentations = require('./grapheditor/create-presentations')
const getEndpointInformationFromDom = require('./grapheditor/get-endpoint-information-from-dom')
const createSimplpProgressBarOnSparqlReset = require('./controller/show-simple-progress-bar-on-sparql-reset')
const bindDisplayingDetailUpdateEvent = require('./controller/bind-displaying-detail-update-event')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const integratedDataset = new IntegtatenDataset()
  const dataset = new Dataset(loader, getEndpointInformationFromDom())
  integratedDataset.addDataset('static', dataset)

  createPresentations(dataset, {
    resultSelector: '#lodqa-results',
    progressSelector: '#lodqa-messages'
  }, integratedDataset)

  const progressBarDom = document.querySelector('#progress-bar')
  createSimplpProgressBarOnSparqlReset(progressBarDom, integratedDataset, 'static', dataset)
  bindDisplayingDetailUpdateEvent(progressBarDom, integratedDataset, 'static' , dataset)

  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => dataset.isVerbose = event.target.checked)
}
