var _ = require('lodash'),
  instance = require('./instance'),
  makeTemplate = require('../render/makeTemplate'),
  reigonTemplate = makeTemplate(function() {
    /*
    <div class="result-region solution-region hide">
        <table>
            <tr>
                <th>solutions</th>
            </tr>
        </table>
    </div>
    <div>
       <input type="button" value="Show solutions in table"></input>
    </div>
    */
  }),
  solutionRowTemplate = makeTemplate(function() {
    /*
    <tr>
        <td class="solution">{{#solutions}}{{id}}: <a target="_blank" href="{{url}}" title="{{url}}">{{label}}</a>{{/solutions}}</td>
    </tr>
    */
  }),
  toLastOfUrl = require('./toLastOfUrl'),
  SolutionLsit = function(domId) {
    var $region = $(reigonTemplate.render())
      .on('click', 'input', function(event) {
        $region.removeClass('hide');
        $(event.target).hide();
      });

    $('#' + domId)
      .append($region);

    return $region.find('table');
  },
  toViewParameters = function(solution, key) {
    return {
      id: key,
      url: solution[key],
      label: toLastOfUrl(solution[key])
    };
  },
  toArray = require('../collection/toArray'),
  toSolutionRow = function(solution) {
    var toParams = _.partial(toViewParameters, solution),
      solutionLinks = Object.keys(solution)
      .map(toParams)
      .reduce(toArray, []);

    return solutionRowTemplate.render({
      solutions: solutionLinks
    });
  },
  privateData = {};

module.exports = {
  onAnchoredPgp: function(domId, anchored_pgp) {
    privateData.domId = domId;
  },
  onSparql: function(sparql) {　　
    privateData.currentSolutionList = null;
  },
  onSolution: function(solution) {
    if (!privateData.currentSolutionList) {
      privateData.currentSolutionList = new SolutionLsit(privateData.domId);
    }

    privateData.currentSolutionList.append(toSolutionRow(solution));
  }
};
