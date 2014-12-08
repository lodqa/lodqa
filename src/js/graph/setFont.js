var _ = require('lodash');

module.exports =  function(value, target) {
    return _.extend(target, {
        font: value
    })
};
