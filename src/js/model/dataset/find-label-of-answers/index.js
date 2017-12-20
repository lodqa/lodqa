const findLabel = require('./find-label')

module.exports = function(uniqAnswers, findLabelOptions, callback) {
  findLabel(uniqAnswers.map((answer) => answer.url), callback, findLabelOptions)
}
