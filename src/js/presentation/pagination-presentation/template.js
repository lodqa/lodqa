const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<span class="answer-summary-pages__prev-link">
  {{#if enablePrev}}
    <a class="answer-summary-pages__label answer-summary-pages__label--with-link" data-paging-direction="prev"disabled="disabled">Previous</a>
  {{/if}}
</span>
<div>
{{#each pages}}
  <span class="answer-summary-pages__page">
    {{#if isCurrent}}
      <span class="answer-summary-pages__label">{{page}}</span>
    {{else}}
      <a class="answer-summary-pages__label answer-summary-pages__label--with-link" data-paging-target="{{page}}">{{page}}</a>
    {{/if}}
  </span>
{{/each}}
</div>
<span class="answer-summary-pages__next-link">
  {{#if enableNext}}
    <a class="answer-summary-pages__label answer-summary-pages__label--with-link" data-paging-direction="next"disabled="disabled">Next</a>
  {{/if}}
</span>
`)
