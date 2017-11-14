const Loader = require('./loader')
const Model = require('./model')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const createPresentations = require('./grapheditor/create-presentations')
const getEndpointInformationFromDom = require('./grapheditor/get-endpoint-information-from-dom')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const model = new Model(loader, getEndpointInformationFromDom())

  createPresentations(model, {
    resultSelector: '#lodqa-results',
    progressSelector: '#lodqa-messages',
    progressBarSelector: '#progress-bar'
  })
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => model.isVerbose = event.target.checked)
}
