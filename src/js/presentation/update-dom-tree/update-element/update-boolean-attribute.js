// Remove boolean attribute, for example 'checked' and 'disabled'.
// See: https://www.w3.org/TR/html5/infrastructure.html#sec-boolean-attributes
// Use a property, because erasing the attribute using the Node.removeAttribute function does not affect the appearance of the DOM
module.exports = function(ast, node, attributeName) {
  if (node.hasAttribute(attributeName)) {
    const astAttribute = ast.attrs.find((a) => a.name === attributeName)

    if (astAttribute) {
      node[attributeName] = true
    } else {
      node[attributeName] = false
      node.removeAttribute(attributeName)
    }
  }
}
