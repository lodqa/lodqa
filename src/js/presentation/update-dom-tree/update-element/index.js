const createElement = require('../create-element')
const updateBooleanAttribute = require('./update-boolean-attribute')

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

    updateBooleanAttribute(ast, element, 'checked')
    updateBooleanAttribute(ast, element, 'disabled')

    // Remove old attributes.
    for (const domAttr of element.attributes) {
      if (!ast.attrs.find((a) => a.name === domAttr.name)) {
        element.removeAttribute(domAttr.name)
      }
    }

    return element
  } else {
    // Switch an old Element to a new Element when tagName is changed.
    const newElement = createElement(ast)
    parentNode.replaceChild(newElement, element)

    return newElement
  }
}
