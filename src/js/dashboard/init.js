const initGrpahEditor = require('./init-grpah-editor')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')
const bindExpertCheckboxEventhandler = require('./bind-expert-checkbox-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindParseItButtonEventhandler()
  bindExpertCheckboxEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}
