const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')
const bindUpdateReadTimeout = require('./index/bind-update-read-timeout')
const updateSampleQueries = require('./index/update-sample-queries')

bindModeButtonEventhandler('grapheditor')

const target = new URL(location.href)
  .searchParams.get('target')

if (target) {
  // Update a parameter of the read_timeout.
  bindUpdateReadTimeout()

  updateSampleQueries(target)
}
