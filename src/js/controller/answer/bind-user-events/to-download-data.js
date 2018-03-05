module.exports = function(answerFilter) {
  return answerFilter.snapshot.map((a) => ({
    url: a.uri,
    label: a.label
  }))
}
