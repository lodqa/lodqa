var _ = require('lodash'),
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
        $region[0].classList.toggle('hide')

        var $input = $(event.target)
        if ($input.val() === 'Show solutions in table') {
          $input.val('Hide solutions in table')
        } else {
          $input.val('Show solutions in table')
        }
      })

    $('#' + domId)
      .append($region)

    return $region.find('table')
  },
  toViewParameters = function(solution, key) {
    return {
      id: key,
      url: solution[key],
      label: toLastOfUrl(solution[key])
    }
  },
  toArray = require('../collection/toArray'),
  toSolutionRow = function(solution) {
    var toParams = _.partial(toViewParameters, solution),
      solutionLinks = Object.keys(solution)
      .map(toParams)
      .reduce(toArray, [])

    return solutionRowTemplate.render({
      solutions: solutionLinks
    })
  },
  privateData = {}

module.exports = {
  onAnchoredPgp(domId) {
    privateData.domId = domId
  },
  onSolution(data) {
    const {solutions} = data

    if(solutions.length > 0){
      const currentSolutionList = new SolutionLsit(privateData.domId)

      for (const solution of solutions) {
        currentSolutionList.append(toSolutionRow(solution))
      }
    }
  }
}
