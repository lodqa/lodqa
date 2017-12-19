module.exports = function(answerFilter) {
  return answerFilter.snapshot.map((a) => ({
    url: a.url,
    label: a.label
  }))
}
