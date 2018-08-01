module.exports = function(mappingsElement) {
  if (!mappingsElement.innerHTML) {
    return false
  }

  const mappings = JSON.parse(mappingsElement.innerHTML)
  const hasTerm = Object.keys(mappings)
    .filter((key) => mappings[key].filter((term) => term)
      .length > 0)

  return Boolean(hasTerm.length)
}
