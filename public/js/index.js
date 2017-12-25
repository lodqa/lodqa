(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(pathname) {
  document.querySelector('#mode-button')
    .addEventListener('click', (e) => {
      // Do not validate the form
      e.stopPropagation()

      const form = document.querySelector('#nlqform')
      const parameters = [`read_timeout=${form.read_timeout.value}`]
      const target = getTarget()
      if (target) {
        parameters.push(`target=${target}`)
      }

      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      location.href = `/${pathname}?${parameters.join('&')}`
    })
}

function getTarget() {
  // A user can select the target at the expert mode.
  const element = document.querySelector('#target-value')
  if (element) {
    return element.value
  }

  // The target is not chenged in the simple mode or the answer page.
  const targetParameter = new URL(location.href).searchParams.get('target')
  if (targetParameter) {
    return decodeURIComponent(targetParameter)
  }
}

},{}],2:[function(require,module,exports){
module.exports = function(callback) {
  document.querySelector('#read-timeout')
    .addEventListener('change', (e) => {
      callback(e.target.value)
    })
}

},{}],3:[function(require,module,exports){
const bindReadTimeoutNumberEventhandler = require('./controller/bind-read-timeout-number-eventhandler')
const bindModeButtonEventhandler = require('./controller/bind-mode-button-eventhandler')

bindModeButtonEventhandler('grapheditor')
bindReadTimeoutNumberEventhandler((readTimeout) => {
  for (const link of document.querySelectorAll('.sample-queries__link')) {
    const url = new URL(link.href)
    url.searchParams.set('read_timeout', readTimeout)
    link.href= url.toString()
  }
})

},{"./controller/bind-mode-button-eventhandler":1,"./controller/bind-read-timeout-number-eventhandler":2}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvY29udHJvbGxlci9iaW5kLW1vZGUtYnV0dG9uLWV2ZW50aGFuZGxlci5qcyIsInNyYy9qcy9jb250cm9sbGVyL2JpbmQtcmVhZC10aW1lb3V0LW51bWJlci1ldmVudGhhbmRsZXIuanMiLCJzcmMvanMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihwYXRobmFtZSkge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbW9kZS1idXR0b24nKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICAvLyBEbyBub3QgdmFsaWRhdGUgdGhlIGZvcm1cbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcblxuICAgICAgY29uc3QgZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNubHFmb3JtJylcbiAgICAgIGNvbnN0IHBhcmFtZXRlcnMgPSBbYHJlYWRfdGltZW91dD0ke2Zvcm0ucmVhZF90aW1lb3V0LnZhbHVlfWBdXG4gICAgICBjb25zdCB0YXJnZXQgPSBnZXRUYXJnZXQoKVxuICAgICAgaWYgKHRhcmdldCkge1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2goYHRhcmdldD0ke3RhcmdldH1gKVxuICAgICAgfVxuXG4gICAgICBpZiAoZm9ybS5xdWVyeS52YWx1ZSkge1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2goYHF1ZXJ5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZvcm0ucXVlcnkudmFsdWUpfWApXG4gICAgICB9XG5cbiAgICAgIGxvY2F0aW9uLmhyZWYgPSBgLyR7cGF0aG5hbWV9PyR7cGFyYW1ldGVycy5qb2luKCcmJyl9YFxuICAgIH0pXG59XG5cbmZ1bmN0aW9uIGdldFRhcmdldCgpIHtcbiAgLy8gQSB1c2VyIGNhbiBzZWxlY3QgdGhlIHRhcmdldCBhdCB0aGUgZXhwZXJ0IG1vZGUuXG4gIGNvbnN0IGVsZW1lbnQgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFyZ2V0LXZhbHVlJylcbiAgaWYgKGVsZW1lbnQpIHtcbiAgICByZXR1cm4gZWxlbWVudC52YWx1ZVxuICB9XG5cbiAgLy8gVGhlIHRhcmdldCBpcyBub3QgY2hlbmdlZCBpbiB0aGUgc2ltcGxlIG1vZGUgb3IgdGhlIGFuc3dlciBwYWdlLlxuICBjb25zdCB0YXJnZXRQYXJhbWV0ZXIgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpLnNlYXJjaFBhcmFtcy5nZXQoJ3RhcmdldCcpXG4gIGlmICh0YXJnZXRQYXJhbWV0ZXIpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHRhcmdldFBhcmFtZXRlcilcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcmVhZC10aW1lb3V0JylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKGUpID0+IHtcbiAgICAgIGNhbGxiYWNrKGUudGFyZ2V0LnZhbHVlKVxuICAgIH0pXG59XG4iLCJjb25zdCBiaW5kUmVhZFRpbWVvdXROdW1iZXJFdmVudGhhbmRsZXIgPSByZXF1aXJlKCcuL2NvbnRyb2xsZXIvYmluZC1yZWFkLXRpbWVvdXQtbnVtYmVyLWV2ZW50aGFuZGxlcicpXG5jb25zdCBiaW5kTW9kZUJ1dHRvbkV2ZW50aGFuZGxlciA9IHJlcXVpcmUoJy4vY29udHJvbGxlci9iaW5kLW1vZGUtYnV0dG9uLWV2ZW50aGFuZGxlcicpXG5cbmJpbmRNb2RlQnV0dG9uRXZlbnRoYW5kbGVyKCdncmFwaGVkaXRvcicpXG5iaW5kUmVhZFRpbWVvdXROdW1iZXJFdmVudGhhbmRsZXIoKHJlYWRUaW1lb3V0KSA9PiB7XG4gIGZvciAoY29uc3QgbGluayBvZiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCcuc2FtcGxlLXF1ZXJpZXNfX2xpbmsnKSkge1xuICAgIGNvbnN0IHVybCA9IG5ldyBVUkwobGluay5ocmVmKVxuICAgIHVybC5zZWFyY2hQYXJhbXMuc2V0KCdyZWFkX3RpbWVvdXQnLCByZWFkVGltZW91dClcbiAgICBsaW5rLmhyZWY9IHVybC50b1N0cmluZygpXG4gIH1cbn0pXG4iXX0=
