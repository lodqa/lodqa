module.exports = function(answersMap, hideSparqls) {
  const originalAnswers = Array.from(answersMap.values())

  // Hide answers accoding to the hidelSparqls
  const answers = originalAnswers.map((a) => Object.assign({}, a, {
    sparqls: excludeHideSparqls(a.sparqls, hideSparqls)
  }))
    .filter((a) => a.sparqls.length)

  return answers
}

function excludeHideSparqls(sparqls, hideSparqls) {
  return sparqls.filter((sparql) => !hideSparqls.has(sparql.sparqlNumber.toString()))
}
