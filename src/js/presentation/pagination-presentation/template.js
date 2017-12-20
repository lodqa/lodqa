const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
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
