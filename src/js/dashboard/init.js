const initGrpahEditor = require('./init-grpah-editor')
const initSampleQueries = require('./init-sample-queries')
const bindSearchButtonEventhandler = require('./bind-search-button-eventhandler')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindSearchButtonEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}
