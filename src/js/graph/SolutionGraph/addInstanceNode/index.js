const instance = require('../../../instance')
const toRed = require('../../toRed')
const toTerm = require('../toTerm')
const toEdge = require('../toEdge')
const toLabelAndSetFontNormal = require('../toLabelAndSetFontNormal')
const switchDirection = require('../switchDirection')

module.exports = function(graph, addEdge, isFocus, bgp, solution) {
  return Object.keys(solution)
    .filter(instance.is)
    .map((id) => toTerm(solution, id))
    .map(toLabelAndSetFontNormal)
    .map((object) => transformIf((term) => isFocus(term.id), toRed, object))
    .reduce((result, term) => {
      const instanceNode = addEdgeToInstance(graph, addEdge, bgp, solution, term)
      result[term.id] = instanceNode

      return result
    }, {})
}

function transformIf(predicate, transform, object) {
  return predicate(object) ? transform(object) : object
}

function addEdgeToInstance(graph, addEdge, bgp, solution, term) {
  const instanceNode = graph.newNode(term)
  const anchoredPgpNodeId = instanceNode.data.id.substr(1)
  const edgeId = 's' + anchoredPgpNodeId
  const anchoredPgpNode = graph.nodeSet[anchoredPgpNodeId]
  const edge = toEdge(solution, edgeId)
  const [source, target] = switchDirection(bgp, [anchoredPgpNodeId, anchoredPgpNode], [term.id, instanceNode])

  addEdge(graph, edge, source, target, '#999999')

  return instanceNode
}
