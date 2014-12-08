module.exports = function(pgp) {
  var graph = require('./lodqaGraph')('lodqa-pgp', {
    width: 690,
    height: 100
  });

  graph.addNodes(graph.graph, Object.keys(pgp.nodes).map(function(key) {
    return {
      id: key,
      label: pgp.nodes[key].text
    };
  }), pgp.focus);

  pgp.edges.forEach(function(edge, index) {
    graph.addEdge(
      graph.graph, {
        id: index,
        label: edge.text
      },
      graph.graph.nodeSet[edge.subject],
      graph.graph.nodeSet[edge.object],
      '#000000'
    );
  });
};
