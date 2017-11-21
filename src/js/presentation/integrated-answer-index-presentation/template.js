const Handlebars = require('handlebars')

module.exports = Handlebars.compile(`
  <div class="integrated-answer-index__dataset-labels">
    {{#each datasets}}
      <div class="integrated-answer-index__dataset-label">
        {{name}}
        <span class="progress-bar__simple-progress-bar__percentage">{{percentage}}%</span>
      </div>
    {{/each}}
  </div>
  {{#each answers}}
    <div class="integrated-answer-index__answer">
      <div class="integrated-answer-index__answer-label">
        <a href="{{url}}">{{label}}</a>
      </div>
      <ul class="integrated-answer-index__datasets">
        {{#each datasets}}
          <li class="integrated-answer-index__dataset">
            <ul class="integrated-answer-index__dataset__sparqls">
              {{#each sparqls}}
                <li class="integrated-answer-index__dataset__sparql">{{> sparql-link}}</li>
              {{/each}}
            </ul>
          </li>
        {{/each}}
      </ul>
    </div>
  {{/each}}
`)
