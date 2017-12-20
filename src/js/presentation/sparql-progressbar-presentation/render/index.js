const updateDomTree = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, data) {
  updateDomTree(dom, template(data))
}
