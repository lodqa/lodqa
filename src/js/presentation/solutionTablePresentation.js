var _ = require('lodash'),
  instance = require('./instance'),
  makeTemplate = require('./makeTemplate'),
  reigonTemplate = makeTemplate(function() {
    /*
    <div class="result-region">
        <table class="solutions-table">
            <tr>
                <th>solutions</th>
            </tr>
        </table>
    </div>
    */
  }),
  solutionRowTemplate = makeTemplate(function() {
    /*
    <tr>
        <td class="solution">{{{solution}}}</td>
    </tr>
    */
  }),
  solutionTemplate = makeTemplate(function() {
    /*
    {{id}}: <a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a>
    */
  }),
  toLastOfUrl = require('./toLastOfUrl'),
  privateData = {};

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    privateData.domId = domId;
  },
  onSparql: function(sparql) {　　
    privateData.currentRegion = null;
  },
  onSolution: function(solution) {
    if (!privateData.currentRegion) {
      var $region = $(reigonTemplate.render());

      privateData.currentRegion = $region.find('.solutions-table');

      $('#' + privateData.domId)
        .append($region);
    }

    var solutionLinks = Object.keys(solution)
      .map(function(key) {
        return {
          id: key,
          url: solution[key]
        };
      })
      .map(function(url) {
        return _.extend(url, {
          label: toLastOfUrl(url.url)
        })
      })
      .map(function(a) {
        return solutionTemplate.render(a);
      }).join(''),
      solutionRow = solutionRowTemplate.render({
        solution: solutionLinks
      });

    privateData.currentRegion.append(solutionRow);
  }
};
