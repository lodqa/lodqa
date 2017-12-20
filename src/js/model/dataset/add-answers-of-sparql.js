module.exports = function(answersMap, uniqAnswers) {
  for (const answer of uniqAnswers) {
    if (!answersMap.has(answer.url)) {
      answersMap.set(answer.url, answer)
    }
  }
}
