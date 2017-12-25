const bindModeSwitchButtonEventhandler = require('../../bind-mode-switch-eventhandler')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const initGrpahEditor = require('./init-grpah-editor')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindModeSwitchButtonEventhandler('')
  bindParseItButtonEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}
