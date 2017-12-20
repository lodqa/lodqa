const updateDomTree = require('../update-dom-tree')
const template = require('./template')

module.exports = class {
  constructor(dom, model) {
    model.on('answer_summary_page_update_event', () => render(dom, model))

    dom.addEventListener('click', ({
      target
    }) => {
      if (target.dataset.pagingDirection === 'prev') {
        model.goPrev()
      } else if (target.dataset.pagingDirection === 'next') {
        model.goNext()
      } else if (target.dataset.pagingTarget) {
        model.goPage(Number(target.dataset.pagingTarget))
      }
    })
  }
}

function render(dom, model) {
  const html = template(model.pages)
  updateDomTree(dom, html)
}
