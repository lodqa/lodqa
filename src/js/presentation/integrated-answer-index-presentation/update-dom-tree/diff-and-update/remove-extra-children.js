module.exports = function(ast, node) {
  // Remove extra nodes
  Array.from(node.childNodes)
    .filter((n, index) => index >= ast.childNodes.length)
    .forEach((extraChild) => node.removeChild(extraChild))
}
