module.exports = function(ast) {
  const element = document.createElement(ast.tagName)
  ast.attrs
    .forEach(({
      name,
      value
    }) => {
      element.setAttribute(name, value)
    })

  return element
}
