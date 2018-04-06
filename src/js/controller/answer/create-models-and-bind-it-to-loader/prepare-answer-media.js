const mediaSelectPresentation = require('../../../presentation/answer-media-presentation')

module.exports = function(loader) {
  const mediaSelect = new mediaSelect(loader)
  new mediaSelectPresentation(document.querySelector('.answer-media'), mediaSelect)

  return mediaSelect
}
