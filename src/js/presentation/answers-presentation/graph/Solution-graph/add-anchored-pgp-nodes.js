const fixNodePosition = require('../fix-node-position')
const toLabelAndSetFontNormal = require('./to-label-and-set-font-normal')

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
    label: nodes[key].term,
    labelFromEndopoint: nodes[key].label
  }
}
