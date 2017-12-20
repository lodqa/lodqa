const {
  updateChildren
} = require('../../update-dom-tree')
const template = require('./template')

module.exports = function(dom, data) {
  updateChildren(dom, template(data))
}
