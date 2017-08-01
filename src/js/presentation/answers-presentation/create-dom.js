module.exports = function(html) {
  const element = document.createElement('div')

  element.innerHTML = html
  return element.children[0]
}
