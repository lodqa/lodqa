const getUniqAnswers = require('../answer/get-uniq-answers')
const findLabel = require('../find-label')

module.exports = function findLabelOfAnswers(model, options) {
  const uniqAnswers = getUniqAnswers(model.currentSolution.solutions, model.focus)

  findLabel(uniqAnswers.map((answer) => answer.url), (url, label) => {
    const answer = model._mergedAnswers.get(url)

    answer.label = label
    answer.labelFound = true

    model.emit('label_update_event')
  }, options)
}
