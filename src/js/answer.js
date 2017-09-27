const Model = require('./model')
const Loader = require('./loader/load-solution')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const beginSearch = require('./answer/begin-search')
const bindHandlerForKeyEvents = require('./answer/bind-handler-for-key-events')
const bindHandlerToShowSparql = require('./answer/bind-handler-to-show-sparql')
const bindLoaderEvents = require('./answer/bind-loader-events')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

const model = new Model()
const loader = new Loader()
const progressBarPresentation = new ProgressBarPresentation('progress-bar')

bindHandlerForKeyEvents(loader)

bindHandlerToShowSparql(['progress-bar', 'answer-index'], 'lightbox', model, loader)

bindLoaderEvents(loader, model, progressBarPresentation, 'answer-index')

beginSearch(loader, 'pgp', 'mappings', 'target', 'read_timeout')

bindModeButtonEventhandler('grapheditor')
