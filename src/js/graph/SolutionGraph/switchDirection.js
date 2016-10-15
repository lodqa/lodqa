module.exports = function switchDirection(bgp, first, second) {
  if (bgp.find((direction) => direction[0] === first[0] && direction[2] === second[0])) {
    return [first[1], second[1]]
  }

  if (bgp.find((direction) => direction[2] === first[0] && direction[0] === second[0])) {
    return [second[1], first[1]]
  }

  throw new Error(`what's wrong?`)
}
