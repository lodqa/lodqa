var _ = require('lodash'),
    bindAnchoredPgpPresentation = function(loader, presentation) {
    var domId = 'lodqa-results';

    loader
      .on('anchored_pgp', _.partial(presentation.onAnchoredPgp, domId));
  },
  bindResultPresentation = function(loader, presentation) {
    bindAnchoredPgpPresentation(loader, presentation);
    loader
      .on('sparql', presentation.onSparql)
      .on('solution', presentation.onSolution);
  },
  bindResult = {
    all: bindResultPresentation,
    anchoredPgp: bindAnchoredPgpPresentation
  };

module.exports = bindResult;
