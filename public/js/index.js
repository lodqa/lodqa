'use strict';

var dashboard = document.querySelector('#dashboard'),
    results = document.querySelector('#results');

dashboard.addEventListener('click', function () {
  dashboard.style['z-index'] = 1;
  results.style['z-index'] = -1;
});

results.addEventListener('click', function () {
  dashboard.style['z-index'] = -1;
  results.style['z-index'] = 1;
});