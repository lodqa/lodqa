/*global Springy:true*/
const toRed = require('../toRed')
const setFont = require('../setFont')

module.exports = function(graph, nodes, focus) {
  nodes
    .map((term) => setFocus(focus, term))
    .map(toNode)
    .forEach((node) => addNode(graph, node))
}

function setFocus(focus, term) {
  return term.id === focus ? toFocus(term) : term
}

function toFocus(term) {
  return toRed(toBigFont(term))
}

function toBigFont(term) {
  setFont('18px Verdana, sans-serif', term)
  return term
}

function toNode(term) {
  return new Springy.Node(term.id, term)
}

function addNode(graph, node) {
  graph.addNode(node)
}
