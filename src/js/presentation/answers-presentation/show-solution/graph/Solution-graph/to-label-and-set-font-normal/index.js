const setFontNormal = require('./set-font-normal')
const toLabel = require('../to-label')

module.exports = function(term) {
  return setFontNormal(toLabel(term))
}
