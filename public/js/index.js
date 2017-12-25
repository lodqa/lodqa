(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(pathname) {
  document.querySelector('#mode-switch')
    .addEventListener('click', (e) => {
      // Do not validate the form.
      e.stopPropagation()

      // Do not add a # URL to the location history.
      e.preventDefault()

      const parameters = []

      const readTimeout = getReadTimeout()
      if(readTimeout){
        parameters.push(`read_timeout=${readTimeout}`)
      }

      const target = getTarget()
      if (target) {
        parameters.push(`target=${target}`)
      }

      const form = document.querySelector('#nlqform')
      if (form.query.value) {
        parameters.push(`query=${encodeURIComponent(form.query.value)}`)
      }

      location.href = `/${pathname}?${parameters.join('&')}`
    })
}

function getReadTimeout() {
  const parameter = new URL(location.href)
    .searchParams.get('read_timeout')
  if (parameter) {
    return decodeURIComponent(parameter)
  }
}

function getTarget() {
  // A user can select the target at the expert mode.
  const element = document.querySelector('#nlqform input[name="target"]')
  if (element) {
    return element.value
  }

  // The target is not chenged in the simple mode or the answer page.
  const parameter = new URL(location.href)
    .searchParams.get('target')
  if (parameter) {
    return decodeURIComponent(parameter)
  }
}

},{}],2:[function(require,module,exports){
const bindModeSwitchEventhandler = require('./controller/bind-mode-switch-eventhandler')

bindModeSwitchEventhandler('grapheditor')

},{"./controller/bind-mode-switch-eventhandler":1}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvY29udHJvbGxlci9iaW5kLW1vZGUtc3dpdGNoLWV2ZW50aGFuZGxlci5qcyIsInNyYy9qcy9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcERBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24ocGF0aG5hbWUpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI21vZGUtc3dpdGNoJylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgLy8gRG8gbm90IHZhbGlkYXRlIHRoZSBmb3JtLlxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuXG4gICAgICAvLyBEbyBub3QgYWRkIGEgIyBVUkwgdG8gdGhlIGxvY2F0aW9uIGhpc3RvcnkuXG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcblxuICAgICAgY29uc3QgcGFyYW1ldGVycyA9IFtdXG5cbiAgICAgIGNvbnN0IHJlYWRUaW1lb3V0ID0gZ2V0UmVhZFRpbWVvdXQoKVxuICAgICAgaWYocmVhZFRpbWVvdXQpe1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2goYHJlYWRfdGltZW91dD0ke3JlYWRUaW1lb3V0fWApXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHRhcmdldCA9IGdldFRhcmdldCgpXG4gICAgICBpZiAodGFyZ2V0KSB7XG4gICAgICAgIHBhcmFtZXRlcnMucHVzaChgdGFyZ2V0PSR7dGFyZ2V0fWApXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZvcm0gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbmxxZm9ybScpXG4gICAgICBpZiAoZm9ybS5xdWVyeS52YWx1ZSkge1xuICAgICAgICBwYXJhbWV0ZXJzLnB1c2goYHF1ZXJ5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZvcm0ucXVlcnkudmFsdWUpfWApXG4gICAgICB9XG5cbiAgICAgIGxvY2F0aW9uLmhyZWYgPSBgLyR7cGF0aG5hbWV9PyR7cGFyYW1ldGVycy5qb2luKCcmJyl9YFxuICAgIH0pXG59XG5cbmZ1bmN0aW9uIGdldFJlYWRUaW1lb3V0KCkge1xuICBjb25zdCBwYXJhbWV0ZXIgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpXG4gICAgLnNlYXJjaFBhcmFtcy5nZXQoJ3JlYWRfdGltZW91dCcpXG4gIGlmIChwYXJhbWV0ZXIpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHBhcmFtZXRlcilcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRUYXJnZXQoKSB7XG4gIC8vIEEgdXNlciBjYW4gc2VsZWN0IHRoZSB0YXJnZXQgYXQgdGhlIGV4cGVydCBtb2RlLlxuICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0gaW5wdXRbbmFtZT1cInRhcmdldFwiXScpXG4gIGlmIChlbGVtZW50KSB7XG4gICAgcmV0dXJuIGVsZW1lbnQudmFsdWVcbiAgfVxuXG4gIC8vIFRoZSB0YXJnZXQgaXMgbm90IGNoZW5nZWQgaW4gdGhlIHNpbXBsZSBtb2RlIG9yIHRoZSBhbnN3ZXIgcGFnZS5cbiAgY29uc3QgcGFyYW1ldGVyID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKVxuICAgIC5zZWFyY2hQYXJhbXMuZ2V0KCd0YXJnZXQnKVxuICBpZiAocGFyYW1ldGVyKSB7XG4gICAgcmV0dXJuIGRlY29kZVVSSUNvbXBvbmVudChwYXJhbWV0ZXIpXG4gIH1cbn1cbiIsImNvbnN0IGJpbmRNb2RlU3dpdGNoRXZlbnRoYW5kbGVyID0gcmVxdWlyZSgnLi9jb250cm9sbGVyL2JpbmQtbW9kZS1zd2l0Y2gtZXZlbnRoYW5kbGVyJylcblxuYmluZE1vZGVTd2l0Y2hFdmVudGhhbmRsZXIoJ2dyYXBoZWRpdG9yJylcbiJdfQ==
