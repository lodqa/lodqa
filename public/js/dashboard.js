/* global graphEditor */
'use strict';

document.addEventListener('DOMContentLoaded', function () {

  // sample queries
  document.querySelector('#button-show-queries').addEventListener('click', function (e) {
    e.stopPropagation();
    var element = document.querySelector('.examples');
    if (element.classList.contains('examples--hidden')) {
      element.classList.remove('examples--hidden');
    } else {
      element.classList.add('examples--hidden');
    }
  });

  document.querySelector('.sample-queries').addEventListener('click', function (e) {
    document.querySelector('#query').value = e.target.text;
    document.querySelector('.examples').classList.add('examples--hidden');
  });

  var editor = graphEditor('/termfinder');

  // init graph
  editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp').innerHTML));

  // add event listeners
  var selector = document.querySelector('#target');
  selector.addEventListener('change', function (e) {
    return changeTarget(e.target.value);
  });

  // initial target
  changeTarget(selector.value);

  function applyConfig(config) {
    setTargetDisplay(config);

    setDictionaryUrl(editor, config);
    setNlqFormTarget(config);
    setEndpoint(config);
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
    document.querySelector('#nlqform input[name="target"]').value = config.name;
  }

  function setEndpoint(config) {
    document.querySelector('#endpoint-url').value = config.endpoint_url;
    document.querySelector('#need-proxy').value = config.name === 'biogateway';
  }

  function setDictionaryUrl(editor, config) {
    var dicUrl = config.dictionary_url;
    editor.setDictionaryUrl(dicUrl);
  }

  function updateExampleQeries(editor, config) {
    var sample_queries = config.sample_queries;

    var dom = document.querySelector('.sample-queries');

    if (sample_queries) {
      var listItems = sample_queries.map(function (q) {
        return '<li><a href="#">' + q + '</a></li>';
      }).join('');

      dom.innerHTML = listItems;
    } else {
      dom.innerHTML = '';
    }
  }

  function changeTarget(target) {
    var url = 'http://targets.lodqa.org/targets/' + target;

    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = function () {
      if (this.readyState === XMLHttpRequest.DONE) {
        if (this.status == 200) {
          var config = JSON.parse(this.response);
          applyConfig(config);
        } else {
          console.log("Gateway error!");
        }
      }
    };
    req.open('GET', url);
    req.setRequestHeader('Accept', 'application/json');
    req.send();
  }
});