const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
  <div class="integrated-answer-index__dataset-information-list">
    {{#each datasets}}
      <div class="integrated-answer-index__dataset-information">
        {{name}}
        <progress class="integrated-answer-index__progress-bar" value="{{value}}" max="{{max}}"></progress>
        <span class="progress-bar__simple-progress-bar__percentage">{{percentage}}%</span>
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
