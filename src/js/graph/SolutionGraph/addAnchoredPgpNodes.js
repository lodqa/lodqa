const fixNodePosition = require('../fixNodePosition')
const toLabelAndSetFontNormal = require('./toLabelAndSetFontNormal')

module.exports = function(graph, addNodes, anchoredPgp) {
  const nodeIds = Object.keys(anchoredPgp.nodes)
  let nodes = nodeIds
    .map((id) => toAnchoredPgpNodeTerm(anchoredPgp.nodes, id))
    .map(toLabelAndSetFontNormal)

  nodes = fixNodePosition(nodes, anchoredPgp.edges)

  addNodes(graph, nodes, anchoredPgp.focus)
}

function toAnchoredPgpNodeTerm(nodes, key) {
  return {
    id: key,
    label: nodes[key].term
  }
}
