const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
<div class="answer-summary__answer-list">
  {{#each this}}
  <div class="answer-summary__answer">
    <h3 class="answer-summary__answer-label"><a href="{{uri}}" target="_blank">{{label}}</a></h3>
    <div class="answer-summary__answer-summary">
      <div class="answer-summary__answer-uri">
        <cite class="answer-summary__answer-uri__cite">{{uri}}</cite>
      </div>
      <div class="answer-summary__answer-url-list">
        {{#each urls}}
          <div class="answer-summary__answer-url">
            <a class="answer-summary__answer-url__label" href="{{forwarding.url}}" target="_blank">
              {{#if rendering}}<i class="far fa-image"></i> {{/if}}
              {{name}}
            </a>
            {{#if rendering}}
              <img class="answer-summary__answer-url__image" src="{{rendering.url}}" title="{{rendering.title}}" alt="{{rendering.title}}">
            {{/if}}
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
