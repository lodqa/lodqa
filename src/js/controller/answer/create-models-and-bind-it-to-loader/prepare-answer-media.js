const AnswerMedia = require('../../../model/answer-media')
const AnswerMediaPresentation = require('../../../presentation/answer-media-presentation')

module.exports = function(loader) {
  const answerMedia = new AnswerMedia(loader)
  new AnswerMediaPresentation(document.querySelector('.answer-media'), answerMedia)

  return answerMedia
}
