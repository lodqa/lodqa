const doIfEsc = require('./do-if-esc')

module.exports = function(loader) {
  return doIfEsc(() => loader.stopSearch())
}
