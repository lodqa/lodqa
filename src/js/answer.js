const Model = require('./model')
const Loader = require('./loader/load-solution')
const ProgressBarPresentation = require('./presentation/progress-bar-presentation')
const beginSearch = require('./answer/begin-search')
const bindCheckboxToToggleShowOnlyHasAnswers = require('./answer/bind-checkbox-to-toggle-show-only-has-answers')
const bindHandlerForKeyEvents = require('./answer/bind-handler-for-key-events')
const bindHandlerToShowSparql = require('./answer/bind-handler-to-show-sparql')
const bindLoaderEvents = require('./answer/bind-loader-events')

const model = new Model()
const loader = new Loader()
const progressBarPresentation = new ProgressBarPresentation('progress-bar')

bindHandlerForKeyEvents(loader)

bindHandlerToShowSparql(['progress-bar', 'answer-index'], 'lightbox', model, loader)

// Bind a handler to switch appearance of sparqls
bindCheckboxToToggleShowOnlyHasAnswers('show-only-has-answers', progressBarPresentation)

bindLoaderEvents(loader, model, progressBarPresentation, 'answer-index')

beginSearch(loader, 'pgp', 'mappings', 'target')

document.querySelector('#download-json-button')
  .addEventListener('click', (e) => {
    // console.log(model.answersMap.values(), model.answersMap);
    e.target.href = `data:,${encodeURIComponent(JSON.stringify(Array.from(model.answersMap.values()).map((s) => ({label: s.label, url: s.url})), null, 2))}`
  })
