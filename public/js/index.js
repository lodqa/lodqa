(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(pathname) {
  document.querySelector('#mode-button')
    .addEventListener('click', (e) => {
      // Do not validate the form
      e.stopPropagation()

      const form = document.querySelector('#nlqform')

      const parameters = [
        `target=${form.target.value}`,
        `read_timeout=${form.read_timeout.value}`
      ]

      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      location.href = `/${pathname}?${parameters.join('&')}`
    })
}

},{}],2:[function(require,module,exports){
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

bindModeButtonEventhandler('grapheditor')

},{"./controller/bind-mode-button-eventhandler":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvY29udHJvbGxlci9iaW5kLW1vZGUtYnV0dG9uLWV2ZW50aGFuZGxlci5qcyIsInNyYy9qcy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXRobmFtZSkge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbW9kZS1idXR0b24nKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICAvLyBEbyBub3QgdmFsaWRhdGUgdGhlIGZvcm1cbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcblxuICAgICAgY29uc3QgZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNubHFmb3JtJylcblxuICAgICAgY29uc3QgcGFyYW1ldGVycyA9IFtcbiAgICAgICAgYHRhcmdldD0ke2Zvcm0udGFyZ2V0LnZhbHVlfWAsXG4gICAgICAgIGByZWFkX3RpbWVvdXQ9JHtmb3JtLnJlYWRfdGltZW91dC52YWx1ZX1gXG4gICAgICBdXG5cbiAgICAgIGlmIChmb3JtLnF1ZXJ5LnZhbHVlKSB7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChgcXVlcnk9JHtlbmNvZGVVUklDb21wb25lbnQoZm9ybS5xdWVyeS52YWx1ZSl9YClcbiAgICAgIH1cblxuICAgICAgbG9jYXRpb24uaHJlZiA9IGAvJHtwYXRobmFtZX0/JHtwYXJhbWV0ZXJzLmpvaW4oJyYnKX1gXG4gICAgfSlcbn1cbiIsImNvbnN0IGJpbmRNb2RlQnV0dG9uRXZlbnRoYW5kbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyL2JpbmQtbW9kZS1idXR0b24tZXZlbnRoYW5kbGVyJylcblxuYmluZE1vZGVCdXR0b25FdmVudGhhbmRsZXIoJ2dyYXBoZWRpdG9yJylcbiJdfQ==
