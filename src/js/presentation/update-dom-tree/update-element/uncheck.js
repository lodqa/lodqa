// Uncheck element if ast has no "checked='checked'" attribute.
// Use the checked property, because erasing the checked attribute using the Node.removeAttribute function does not affect the appearance of the DOM
module.exports = function(ast, element) {
  if (element.checked) {
    const attributeChecked = ast.attrs.find((a) => a.name === 'checked')
    if (attributeChecked) {
      if (attributeChecked.value !== 'checked') {
        element.checked = false
      }
    } else {
      element.checked = false
    }
  }
}
