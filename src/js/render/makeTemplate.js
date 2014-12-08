var _ = require('lodash'),
  multiline = require('multiline'),
  Hogan = require('hogan.js');

module.exports = _.compose(_.bind(Hogan.compile, Hogan), multiline);
