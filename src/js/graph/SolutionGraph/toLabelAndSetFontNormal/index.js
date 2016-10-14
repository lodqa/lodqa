const setFontNormal = require('./setFontNormal')
const toLabel = require('../toLabel')

module.exports = function(term) {
  return setFontNormal(toLabel(term))
}
