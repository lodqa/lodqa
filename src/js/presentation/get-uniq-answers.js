const toAnswers = require('./to-answers')

module.exports = function(solutions, focus) {
  return Array
    .from(
      new Map(
        toAnswers(solutions, focus)
          .map((answer) => [answer.url, answer])
      )
        .values()
    )
}
