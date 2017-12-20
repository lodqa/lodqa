const handlebars = require('handlebars')

module.exports = handlebars.compile(`
  <div class="sparlq-progressbar">
    <progress class="sparlq-progressbar__progress" value="{{value}}" max="{{max}}"></progress>
    <span class="sparlq-progressbar__percentage">{{percentage}}%</span>
    <span class="sparlq-progressbar__show-detail-checkbox">
      <input type="checkbox" id="show-detail-progressbar" class="show-detail-progressbar" {{#if showDetail}}checked="checked"{{/if}}>
      <label for="show-detail-progressbar">Details</label>
    </span>
  </div>
`)
