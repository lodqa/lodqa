var _ = require('lodash'),
  instance = require('./instance'),
  SolutionGraph = require('./SolutionGraph'),
  privateData = {};

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    privateData.domId = domId;
    privateData.anchoredPgp = anchored_pgp;
    privateData.focus = anchored_pgp.focus;
    privateData.edges = anchored_pgp.edges;
  },
  onSparql: function(sparql) {
    privateData.graph = null;
  },
  onSolution: function(solution) {
    if (!privateData.graph) {
      privateData.graph = new SolutionGraph(privateData.domId, {
        width: 690,
        height: 400
      });
      privateData.graph.addAnchoredPgpNodes(privateData.anchoredPgp);
    }

    var isFocus = _.partial(instance.isNodeId, privateData.focus),
      instanceNodes = privateData.graph.addInstanceNode(isFocus, solution),
      transitNodes = privateData.graph.addTransitNode(solution);

    privateData.graph.addPath(solution, privateData.edges, transitNodes, instanceNodes);
  }
};
