module.exports = function(ast, node) {
  if (node.nodeValue !== ast.value) {
    node.nodeValue = ast.value
  }
}
