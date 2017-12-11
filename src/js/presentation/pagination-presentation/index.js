const Handlebars = require('handlebars')

const {
  updateChildren
} = require('../update-dom-tree')

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

const template = Handlebars.compile(`
<span class="answer-summary-pages__link-prev">
  {{#if enablePrev}}
    <a class="answer-summary-pages__link-label" data-paging-direction="prev"disabled="disabled">Previous</a>
  {{/if}}
</span>
<div>
{{#each pages}}
  <span class="answer-summary-pages__page">
    {{#if isCurrent}}
      <span class="answer-summary-pages__link-label answer-summary-pages__link-label--current">{{page}}</span>
    {{else}}
      <a class="answer-summary-pages__link-label" data-paging-target="{{page}}">{{page}}</a>
    {{/if}}
  </span>
{{/each}}
</div>
<span class="answer-summary-pages__link-next">
  {{#if enableNext}}
    <a class="answer-summary-pages__link-label" data-paging-direction="next"disabled="disabled">Next</a>
  {{/if}}
</span>
`)

function render(dom, model) {
  const html = template(model.pages)
  updateChildren(dom, html)
}
