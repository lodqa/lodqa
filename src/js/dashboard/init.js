const bindModeButtonEventhandler = require('../controller/bind-mode-button-eventhandler')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const initGrpahEditor = require('./init-grpah-editor')
const bindReadTimeout = require('./bind-read-timeout')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindModeButtonEventhandler('')
  bindParseItButtonEventhandler()
  bindReadTimeout()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}
