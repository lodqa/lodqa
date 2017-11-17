const doIfEsc = require('./do-if-esc')

module.exports = function(loaders) {
  return doIfEsc(() => loaders.forEach(l => l.stopSearch()))
}
