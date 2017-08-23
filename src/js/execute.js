const Model = require('./model')
const Loader = require('./loader/load-solution')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const beginSearch = require('./execute/begin-search')
const bindCheckboxToToggleShowOnlyHasAnswers = require('./execute/bind-checkbox-to-toggle-show-only-has-answers')
const bindHandlerForKeyEvents = require('./execute/bind-handler-for-key-events')
const bindHandlerToShowSparql = require('./execute/bind-handler-to-show-sparql')
const bindLoaderEvents = require('./execute/bind-loader-events')

const model = new Model()
const loader = new Loader()
const progressBarPresentation = new ProgressBarPresentation('progress-bar')

bindHandlerForKeyEvents(loader)

bindHandlerToShowSparql(['progress-bar', 'answer-index'], 'lightbox', model, loader)

// Bind a handler to switch appearance of sparqls
bindCheckboxToToggleShowOnlyHasAnswers('show-only-has-answers', progressBarPresentation)

bindLoaderEvents(loader, model, progressBarPresentation, 'answer-index')

beginSearch(loader, 'pgp', 'mappings', 'target')
