const handlebars = require('handlebars')

module.exports = handlebars.compile(`
  <div class="progress-bar__simple-progress-bar">
    <progress class="progress-bar__simple-progress-bar__progress" value="{{value}}" max="{{max}}"></progress>
    <span class="progress-bar__simple-progress-bar__percentage">{{percentage}}%</span>
    <span class="progress-bar__simple-progress-bar__show-detail-checkbox">
      <input type="checkbox" id="show-detail-progress-bar" class="show-detail-progress-bar" {{#if showDetail}}checked="checked"{{/if}}>
      <label for="show-detail-progress-bar">Details</label>
    </span>
  </div>
`)
