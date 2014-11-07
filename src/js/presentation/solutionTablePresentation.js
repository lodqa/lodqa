var _ = require('lodash'),
  instance = require('./instance'),
  makeTemplate = require('./makeTemplate'),
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
  toSolutionRow = function(solution) {
    var solutionLinks = Object.keys(solution)
      .map(function(key) {
        return {
          id: key,
          url: solution[key],
          label: toLastOfUrl(solution[key])
        };
      })
      .map(function(url) {
        return solutionTemplate.render(url);
      });

    return solutionRowTemplate.render({
      solution: solutionLinks.join('')
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
