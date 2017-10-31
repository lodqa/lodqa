const Model = require('./model')
const Loader = require('./loader/load-solution')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const beginSearch = require('./answer/begin-search')
const bindHandlerForKeyEvents = require('./answer/bind-handler-for-key-events')
const bindHandlerToShowSparql = require('./answer/bind-handler-to-show-sparql')
const bindLoaderEvents = require('./answer/bind-loader-events')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')


for (const parent of document.querySelectorAll('.answers-for-dataset')) {
  const name = parent.getAttribute('data-dataset')
  const model = new Model({
    endpointUrl: parent.querySelector('.answers-for-dataset__endpoint-url')
      .value,
    needProxy: parent.querySelector('.answers-for-dataset__need-proxy')
      .value === 'true'
  })
  const loader = new Loader()
  const progressBarPresentation = new ProgressBarPresentation(name, parent, '.answers-for-dataset__progress-bar')

  bindHandlerForKeyEvents(loader)

  bindHandlerToShowSparql(parent, ['.answers-for-dataset__progress-bar', '.answers-for-dataset__answer-index'], 'lightbox', model, loader)

  bindLoaderEvents(loader, model, progressBarPresentation, parent, '.answers-for-dataset__answer-index')

  beginSearch(loader, 'pgp', parent, '.answers-for-dataset__mappings', name, 'read_timeout')

  bindModeButtonEventhandler('grapheditor')
}
