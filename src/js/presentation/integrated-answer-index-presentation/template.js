const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
  <div class="integrated-answer-index__dataset-information-list">
    {{#each datasets}}
      <div class="integrated-answer-index__dataset-information">
        <div class="integrated-answer-index__dataset-information-row">
          {{name}}
          <div>
            <input
              type="checkbox"
              id="integrated-answer-index__show-detail-progress-bar-{{name}}"
              data-name="{{name}}" class="show-detail-progress-bar"
              {{#if checked}}checked="checked"{{/if}}
              >
            <label for="integrated-answer-index__show-detail-progress-bar-{{name}}">Details</label>
          </div>
        </div>
        <div class="integrated-answer-index__dataset-information-row">
          <progress class="integrated-answer-index__progress-bar" value="{{value}}" max="{{max}}"></progress>
          <span>{{percentage}}%</span>
        </div>
      </div>
    {{/each}}
  </div>
  {{#each answers}}
    <div class="integrated-answer-index__answer">
      <div class="integrated-answer-index__answer-label">
        <a href="{{url}}">{{label}}</a>
      </div>
      <ul class="integrated-answer-index__dataset-sparql-list">
        {{#each datasets}}
          <li class="integrated-answer-index__dataset-sparql">
            <ul class="integrated-answer-index__sparql-list">
              {{#each sparqls}}
                <li class="integrated-answer-index__sparql">{{> sparql-link}}</li>
              {{/each}}
            </ul>
          </li>
        {{/each}}
      </ul>
    </div>
  {{/each}}
`)
