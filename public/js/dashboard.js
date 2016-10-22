/* global graphEditor*/'use strict';

!(function () {
  var targets = JSON.parse(document.querySelector('#targets').innerHTML);
  var targeth = targets.reduce(function (a, b) {
    a[b.name] = b;
    return a;
  }, {});
  var editor = graphEditor('/termfinder');

  // init graph
  editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp').innerHTML));

  // add event listeners
  var selector = document.querySelector('#target');
  selector.addEventListener('change', function (e) {
    return applayTarget(e.target, targeth, editor);
  });

  document.querySelector('#sample_queries2').addEventListener('change', function (e) {
    return document.querySelector('#query').value = e.target.value;
  });

  // initial target
  applayTarget(selector, targeth, editor);

  function applayTarget(selector, targeth, editor) {
    var config = targeth[selector.value];

    setTargetDisplay(config);
    setDictionaryUrl(editor, config);
    setNlqFormTarget(config);
    updateExampleQeries(editor, config);
  }

  function setTargetDisplay(config) {
    if (config['home']) {
      document.querySelector('#target-display').innerHTML = '@<a href="' + config['home'] + '">' + config['name'] + '</a>';
    } else {
      document.querySelector('#target-display').innerHTML = '@' + config['name'];
    }
  }

  function setNlqFormTarget(config) {
    // to setup target in NLQ form
    document.querySelector('#nlqform input[name="target"]').value = config['name'];
  }

  function setDictionaryUrl(editor, config) {
    var dicUrl = config.dictionary_url;
    editor.setDictionaryUrl(dicUrl);
  }

  function updateExampleQeries(editor, config) {
    var sample_queries = config.sample_queries;
    var sampleQueries2 = document.querySelector('#sample_queries2');

    if (sample_queries) {
      var options = sample_queries.map(function (q) {
        return '<option>' + q + '</option>';
      }).join();
      sampleQueries2.innerHTML = options;
      sampleQueries2.value = document.querySelector('#query').value;
    } else {
      sampleQueries2.innerHTML = '';
    }
  }
})();