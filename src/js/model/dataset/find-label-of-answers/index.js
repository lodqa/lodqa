const getUniqAnswers = require('../get-uniq-answers')
const findLabel = require('./find-label')

module.exports = function(dataset, findLabelOptions, callback) {
  const uniqAnswers = getUniqAnswers(dataset.currentSolution.solutions, dataset.focus)

  findLabel(uniqAnswers.map((answer) => answer.url), callback, findLabelOptions)
}
