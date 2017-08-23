const createHandlerForKeyEvents = require('./create-handler-for-key-events')
const bindOneKeyupHandler = require('./bind-one-keyup-handler')

module.exports = function bindHandlerForKeyEvents(loader) {
  const stopSearchIfEsc = createHandlerForKeyEvents(loader)
  bindOneKeyupHandler(stopSearchIfEsc)
}
