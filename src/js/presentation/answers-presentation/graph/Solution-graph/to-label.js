const toLastOfUrl = require('../../../../to-last-of-url')

module.exports = function(term) {
  return {
    id: term.id,
    label: term.labelFromEndopoint || toLastOfUrl(term.label),
    url: term.label
  }
}
