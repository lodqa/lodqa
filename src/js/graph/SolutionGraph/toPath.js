module.exports = function(graph, edges, transitNodes, instanceNodes, pathInfo) {
  const edge = edges[pathInfo.no]

  return {
    id: pathInfo.id,
    source: toGraphNode(graph, toGraphId(transitNodes, instanceNodes, fromSubject(edge, pathInfo))),
    target: toGraphNode(graph, toGraphId(transitNodes, instanceNodes, fromObject(edge, pathInfo)))
  }
}

function fromSubject(edge, pathInfo) {
  var anchoredPgpNodeId = edge.subject

  return {
    transitNodeId: 'x' + pathInfo.no + (pathInfo.childNo - 1),
    instanceNodeId: 'i' + anchoredPgpNodeId,
    anchoredPgpNodeId: anchoredPgpNodeId
  }
}

function fromObject(edge, pathInfo) {
  var anchoredPgpNodeId = edge.object

  return {
    transitNodeId: 'x' + pathInfo.no + pathInfo.childNo,
    instanceNodeId: 'i' + anchoredPgpNodeId,
    anchoredPgpNodeId: anchoredPgpNodeId
  }
}

function toGraphNode(graph, id) {
  return graph.nodeSet[id]
}

function toGraphId(transitNodes, instanceNodes, canididateIds) {
  if (transitNodes[canididateIds.transitNodeId]) {
    return transitNodes[canididateIds.transitNodeId].id
  } else if (instanceNodes[canididateIds.instanceNodeId]) {
    return instanceNodes[canididateIds.instanceNodeId].id
  } else {
    return canididateIds.anchoredPgpNodeId
  }
}
