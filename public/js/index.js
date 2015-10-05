'use strict';

var dashboard = document.querySelector('#dashboard'),
    subboard = document.querySelector('#subboard'),
    results = document.querySelector('#results');

dashboard.addEventListener('click', function () {
  dashboard.style['z-index'] = 1;
  subboard.style['z-index'] = -1;
  results.style['z-index'] = -1;
});

subboard.addEventListener('click', function () {
  dashboard.style['z-index'] = -1;
  subboard.style['z-index'] = 1;
  results.style['z-index'] = -1;
});

results.addEventListener('click', function () {
  dashboard.style['z-index'] = -1;
  subboard.style['z-index'] = -1;
  results.style['z-index'] = 1;
});