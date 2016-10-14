const instance = require('../../../instance')
const toRed = require('../../toRed')
const toTerm = require('../toTerm')
const toEdge = require('../toEdge')
const toLabelAndSetFontNormal = require('../toLabelAndSetFontNormal')

module.exports = function(graph, addEdge, isFocus, solution) {
  return Object.keys(solution)
    .filter(instance.is)
    .map((id) => toTerm(solution, id))
    .map(toLabelAndSetFontNormal)
    .map((object) => transformIf((term) => isFocus(term.id), toRed, object))
    .reduce((result, term) => {
      const instanceNode = graph.newNode(term)

      addEdgeToInstance(graph, addEdge, solution, instanceNode)
      result[term.id] = instanceNode

      return result
    }, {})
}

function transformIf(predicate, transform, object) {
  return predicate(object) ? transform(object) : object
}

function addEdgeToInstance(graph, addEdge, solution, instanceNode) {
  const anchoredPgpNodeId = instanceNode.data.id.substr(1)
  const edgeId = 's' + anchoredPgpNodeId
  const anchoredPgpNode = graph.nodeSet[anchoredPgpNodeId]
  const edge = toEdge(solution, edgeId)

  addEdge(graph, edge, anchoredPgpNode, instanceNode, '#999999')
}
