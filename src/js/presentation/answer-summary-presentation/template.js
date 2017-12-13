const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<div class="answer-summary__answer-list">
  {{#each this}}
  <div class="answer-summary__answer">
    <h3 class="answer-summary__answer-label"><a href="{{url}}" target="_blank">{{label}}</a></h3>
    <div class="answer-summary__answer-summary">
      <div class="answer-summary__answer-url">
        <cite class="answer-summary__answer-url__cite">{{url}}</cite>
      </div>
      <div class="answer-summary__sparql-list">
        {{#each sparqls}}
          <a href="#" class="sparql-link answer-summary__sparql-link" data-dataset-name="{{dataset}}" data-sparql-number="{{number}}">S{{parentNumber}}-{{number}}</a>
        {{/each}}
      </div>
    </div>
  </div>
  {{/each}}
</diz>
`)
