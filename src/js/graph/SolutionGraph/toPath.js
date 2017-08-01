const switchDirection = require('./switchDirection')

module.exports = function(graph, bgp, edges, transitNodes, instanceNodes, pathInfo) {
  const edge = edges[pathInfo.no]
  const subject = toIdAndNode(graph, transitNodes, instanceNodes, fromSubject(edge, pathInfo))
  const object = toIdAndNode(graph, transitNodes, instanceNodes, fromObject(edge, pathInfo))
  const [source, target] = switchDirection(bgp, subject, object)

  return {
    id: pathInfo.id,
    source,
    target
  }
}

function fromSubject(edge, pathInfo) {
  const anchoredPgpNodeId = edge.subject

  return {
    transitNodeId: 'x' + pathInfo.no + (pathInfo.childNo - 1),
    instanceNodeId: 'i' + anchoredPgpNodeId,
    anchoredPgpNodeId: anchoredPgpNodeId
  }
}

function fromObject(edge, pathInfo) {
  const anchoredPgpNodeId = edge.object

  return {
    transitNodeId: 'x' + pathInfo.no + pathInfo.childNo,
    instanceNodeId: 'i' + anchoredPgpNodeId,
    anchoredPgpNodeId: anchoredPgpNodeId
  }
}

function toIdAndNode(graph, transitNodes, instanceNodes, canididateIds) {
  if (transitNodes[canididateIds.transitNodeId]) {
    return [canididateIds.transitNodeId, transitNodes[canididateIds.transitNodeId]]
  } else if (instanceNodes[canididateIds.instanceNodeId]) {
    return [canididateIds.instanceNodeId, instanceNodes[canididateIds.instanceNodeId]]
  } else {
    return [canididateIds.anchoredPgpNodeId, graph.nodeSet[canididateIds.anchoredPgpNodeId]]
  }
}
