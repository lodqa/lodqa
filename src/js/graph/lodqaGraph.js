var _ = require('lodash'),
  setFont = require('./setFont'),
  toRed = require('./toRed'),
  updateLinkOnSelect = function(link, springy) {
    springy.event
      .on('selected', function(selected) {
        link
          .text(selected.node.data.url)
          .attr('href', selected.node.data.url)
      })
  },
  Graph = function(domId, options) {
    var graph = new Springy.Graph(),
      link = $('<a target="_blank">'),
      canvas = $('<canvas>')
      .attr(options)

    $('#' + domId)
      .append(link)
      .append(canvas)

    var springy = canvas.springy({
      graph: graph
    })

    updateLinkOnSelect(link, springy)

    return graph
  },
  toNode = function(term) {
    return new Springy.Node(term.id, term)
  },
  addNode = function(graph, node) {
    graph.addNode(node)
  },
  toBigFont = _.partial(setFont, '18px Verdana, sans-serif'),
  toFocus = _.compose(toRed, toBigFont),
  setFocus = function(focus, term) {
    return term.id === focus ? toFocus(term) : term
  },
  addNodes = function(graph, nodes, focus) {
    nodes
      .map(_.partial(setFocus, focus))
      .map(toNode)
      .forEach(_.partial(addNode, graph))
  },
  addEdge = function(graph, edge, node1, node2, color) {
    edge = Object.assign(edge, {
      color: color
    })

    return graph.newEdge(node1, node2, edge)
  }

module.exports = function(domId, options) {
  var graph = new Graph(domId, options)

  return {
    graph: graph,
    addNodes: addNodes,
    addEdge: addEdge
  }
}
