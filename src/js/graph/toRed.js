var _ = require('lodash');

module.exports = function(term) {
    return _.extend(term, {
        color: '#FF512C'
    });
};
