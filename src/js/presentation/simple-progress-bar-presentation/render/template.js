const handlebars = require('handlebars')

module.exports = handlebars.compile(`
  <div class="progress-bar__simple-progress-bar">
    <progress class="progress-bar__simple-progress-bar__progress" value="0" max="1"></progress>
    <span class="progress-bar__simple-progress-bar__percentage">0%</span>
    <span class="progress-bar__simple-progress-bar__show-detail-checkbox">
      <input type="checkbox" id="show-detail-progress-bar-{{name}}" class="show-detail-progress-bar">
      <label for="show-detail-progress-bar-{{name}}">Details</label>
    </span>
  </div>
`)
