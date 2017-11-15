const getUniqAnswers = require('../get-uniq-answers')
const findLabel = require('./find-label')

module.exports = function(model, findLabelOptions, callback) {
  const uniqAnswers = getUniqAnswers(model.currentSolution.solutions, model.focus)

  findLabel(uniqAnswers.map((answer) => answer.url), callback, findLabelOptions)
}
