const Loader = require('./loader')
const Model = require('./model')
const bindSearchButton = require('./grapheditor/bind-search-button')
const bindStopSearchButton = require('./grapheditor/bind-stop-search-button')
const bindLoaderEvents = require('./grapheditor/bind-loader-events')
const getEndpointInformationFromDom = require('./grapheditor/get-endpoint-information-from-dom')

document.addEventListener('DOMContentLoaded', () => setTimeout(init, 150))

function init() {
  const loader = new Loader()
  const isVerbose = {
    value: false
  }
  const model = new Model(loader, getEndpointInformationFromDom())

  bindLoaderEvents('lodqa-results', 'lodqa-messages', isVerbose, model)
  bindSearchButton(loader)
  bindStopSearchButton(loader)

  const checkbox = document.querySelector('#verbose')
  checkbox.addEventListener('change', (event) => isVerbose.value = event.target.checked)
}
