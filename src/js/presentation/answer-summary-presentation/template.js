const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<div class="answer-summary__answer-list">
  {{#each this}}
  <div class="answer-summary__answer">
    <div class="answer-summary__answer-title">
      <h3 class="answer-summary__answer-title-label">
        <a href="{{uri}}" target="_blank">{{label}}</a>
        {{#if first_rendering}}<img class="answer-summary__answer-title-image" src="{{first_rendering.url}}" title="{{first_rendering.title}}" alt="{{first_rendering.title}}">{{/if}}
      </h3>
    </div>
    <div class="answer-summary__answer-summary">
      <div class="answer-summary__answer-uri">
        <cite class="answer-summary__answer-uri__cite">{{uri}}</cite>
      </div>
      <div class="answer-summary__answer-url-list">
        {{#each urls}}
          <div class="answer-summary__answer-url" data-rendering="{{rendering}}" data-answer-uri="{{../uri}}" data-url-index="{{@index}}">
            <a class="answer-summary__answer-url__label" href="{{forwarding.url}}" target="_blank">{{#if rendering}}<i class="far fa-image"></i> {{/if}}{{name}}</a>
          </div>
        {{/each}}
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
