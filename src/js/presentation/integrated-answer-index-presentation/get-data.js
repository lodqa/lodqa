module.exports = function(integratedDataset) {
  const {
    answers
  } = integratedDataset.integratedAnswerIndex
  const data = answers.map(a => ({
    url: a.url,
    label: a.label
  }))
  return data
}
