const handlebars = require('handlebars')

module.exports = handlebars.compile(`
  <div class="progress-bar__simple-progress-bar">
    {{#if sparqls}}
      <progress class="progress-bar__simple-progress-bar__progress" value="0" max="{{sparqls.length}}"></progress>
      <span class="progress-bar__simple-progress-bar__percentage">0%</span>
    {{else}}
      <progress class="progress-bar__simple-progress-bar__progress"></progress>
      <span class="progress-bar__simple-progress-bar__percentage">100%</span>
    {{/if}}
    <span class="progress-bar__simple-progress-bar__show-detail-checkbox">
      <input type="checkbox" id="show-detail-progress-bar-{{name}}" class="show-detail-progress-bar">
      <label for="show-detail-progress-bar-{{name}}">Details</label>
    </span>
  </div>
`)
