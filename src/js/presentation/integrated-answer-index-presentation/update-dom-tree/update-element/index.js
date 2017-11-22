const createElement = require('../create-element')
const uncheck = require('./uncheck')

module.exports = function(ast, element, parentNode) {
  if (ast.tagName.toUpperCase() === element.tagName) {
    // Update only attributes.
    ast.attrs
      .forEach(({
        name,
        value
      }) => {
        element.setAttribute(name, value)
      })

    uncheck(ast, element)

    return element
  } else {
    // Switch an old Element to a new Element when tagName is changed.
    const newElement = createElement(ast)
    parentNode.replaceChild(newElement, element)

    return newElement
  }
}
