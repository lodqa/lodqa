const Loader = require('./loader')
const IntegtatenDataset = require('./model/integratedDataset')
const Dataset = require('./model/dataset')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const createPresentations = require('./grapheditor/create-presentations')
const getEndpointInformationFromDom = require('./grapheditor/get-endpoint-information-from-dom')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const integratedDataset = new IntegtatenDataset()
  const dataset = new Dataset(loader, getEndpointInformationFromDom())
  integratedDataset.addDataset('static', dataset)

  createPresentations(dataset, {
    resultSelector: '#lodqa-results',
    progressSelector: '#lodqa-messages',
    progressBarSelector: '#progress-bar'
  }, integratedDataset)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => dataset.isVerbose = event.target.checked)
}
