const initGrpahEditor = require('./init-grpah-editor')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')
const bindModeButtonEventhandler = require('../controller/bind-mode-button-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindParseItButtonEventhandler()
  bindModeButtonEventhandler('')

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}
