(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
const init = require('./dashboard/init')

document.addEventListener('DOMContentLoaded', init)

},{"./dashboard/init":10}],2:[function(require,module,exports){
module.exports = function() {
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

      if (location.pathname.includes('expert')) {
        location.href = `/?${parameters.join('&')}`
      } else {
        location.href = `/expert?${parameters.join('&')}`
      }
    })
}

},{}],3:[function(require,module,exports){
module.exports = function() {
  const button = document.querySelector('#parse-it-button')

  if (button) {
    button.addEventListener('click', (e) => {
      const form = document.querySelector('#nlqform')

      if (form.checkValidity()) {
        // Do not submit form.
        e.preventDefault()
        location.href = `/expert?query=${encodeURIComponent(form.query.value)}&target=${form.target.value}&read_timeout=${form.read_timeout.value}`
      } else {
        form.querySelector('#query')
          .focus()
      }
    })
  }
}

},{}],4:[function(require,module,exports){
module.exports = function(config) {
  setTargetDisplay(config)
  setNlqFormTarget(config)
  setEndpoint(config)
  updateExampleQeries(config)
}

function setTargetDisplay(config) {
  if (config['home']) {
    document.querySelector('#target-display')
      .innerHTML = `@<a href="${config['home']}">${config['name']}</a>`
  } else {
    document.querySelector('#target-display')
      .innerHTML = `@${config['name']}`
  }
}

function setNlqFormTarget(config) {
  // to setup target in NLQ form
  document.querySelector('#nlqform input[name="target"]')
    .value = config.name
}

function setEndpoint(config) {
  document.querySelector('#endpoint-url')
    .value = config.endpoint_url
  document.querySelector('#need-proxy')
    .value = (config.name === 'biogateway')
}

function updateExampleQeries(config) {
  const {
    sample_queries
  } = config
  const dom = document.querySelector('.sample-queries')

  if (sample_queries) {
    const listItems = sample_queries
      .map((q) => `<li><a href="#">${q}</a></li>`)
      .join('')

    dom.innerHTML = listItems
  } else {
    dom.innerHTML = ''
  }
}

},{}],5:[function(require,module,exports){
const applyConfig = require('./apply-config')
const setDictionaryUrl = require('./set-dictionary-url')

module.exports = function(target, editor = null) {
  const url = `http://targets.lodqa.org/targets/${target}`
  const req = new XMLHttpRequest()

  req.onreadystatechange = function() {
    if (this.readyState === XMLHttpRequest.DONE) {
      if (this.status == 200) {
        const config = JSON.parse(this.response)
        applyConfig(config)
        if (editor) {
          setDictionaryUrl(editor, config)
        }
      } else {
        console.log('Gateway error!')
      }
    }
  }
  req.open('GET', url)
  req.setRequestHeader('Accept', 'application/json')
  req.send()
}

},{"./apply-config":4,"./set-dictionary-url":7}],6:[function(require,module,exports){
const changeTarget = require('./change-target')
module.exports = function bindTargetChangeEventhandler(editor) {
  // add event listeners
  const selector = document.querySelector('#target')
  if(selector) {
    selector.addEventListener('change', (e) => changeTarget(e.target.value, editor))

    // initial target
    changeTarget(selector.value, editor)
  }
}

},{"./change-target":5}],7:[function(require,module,exports){
module.exports = function(editor, config) {
  const dicUrl = config.dictionary_url
  const predDicUrl = config.pred_dictionary_url
  editor.setDictionaryUrl(dicUrl, predDicUrl)
}

},{}],8:[function(require,module,exports){
/* global graphEditor */
module.exports = function() {
  if (window.graphEditor) {
    const editor = graphEditor('/termfinder')

    // init graph
    editor.addPgp(JSON.parse(document.querySelector('#lodqa-pgp')
      .innerHTML))

    return editor
  }
}

},{}],9:[function(require,module,exports){
module.exports = function() {
  // sample queries
  document.querySelector('#button-show-queries')
    .addEventListener('click', (e) => {
      e.stopPropagation()
      const element = document.querySelector('.examples')
      if (element.classList.contains('examples--hidden')) {
        element.classList.remove('examples--hidden')
      } else {
        element.classList.add('examples--hidden')
      }
    })

  document.querySelector('.sample-queries')
    .addEventListener('click', (e) => {
      document.querySelector('#query')
        .value = e.target.text
      document.querySelector('.examples')
        .classList.add('examples--hidden')
    })
}

},{}],10:[function(require,module,exports){
const initGrpahEditor = require('./init-grpah-editor')
const initSampleQueries = require('./init-sample-queries')
const bindParseItButtonEventhandler = require('./bind-parse-it-button-eventhandler')
const bindTargetChangeEventhandler = require('./bind-target-change-eventhandler')
const bindModeButtonEventhandler = require('./bind-mode-button-eventhandler')

module.exports = function() {
  initSampleQueries()
  bindParseItButtonEventhandler()
  bindModeButtonEventhandler()

  const editor = initGrpahEditor()
  bindTargetChangeEventhandler(editor)
}

},{"./bind-mode-button-eventhandler":2,"./bind-parse-it-button-eventhandler":3,"./bind-target-change-eventhandler":6,"./init-grpah-editor":8,"./init-sample-queries":9}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvanMvZGFzaGJvYXJkLmpzIiwic3JjL2pzL2Rhc2hib2FyZC9iaW5kLW1vZGUtYnV0dG9uLWV2ZW50aGFuZGxlci5qcyIsInNyYy9qcy9kYXNoYm9hcmQvYmluZC1wYXJzZS1pdC1idXR0b24tZXZlbnRoYW5kbGVyLmpzIiwic3JjL2pzL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL2FwcGx5LWNvbmZpZy5qcyIsInNyYy9qcy9kYXNoYm9hcmQvYmluZC10YXJnZXQtY2hhbmdlLWV2ZW50aGFuZGxlci9jaGFuZ2UtdGFyZ2V0LmpzIiwic3JjL2pzL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL2luZGV4LmpzIiwic3JjL2pzL2Rhc2hib2FyZC9iaW5kLXRhcmdldC1jaGFuZ2UtZXZlbnRoYW5kbGVyL3NldC1kaWN0aW9uYXJ5LXVybC5qcyIsInNyYy9qcy9kYXNoYm9hcmQvaW5pdC1ncnBhaC1lZGl0b3IuanMiLCJzcmMvanMvZGFzaGJvYXJkL2luaXQtc2FtcGxlLXF1ZXJpZXMuanMiLCJzcmMvanMvZGFzaGJvYXJkL2luaXQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTs7QUNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1pBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiY29uc3QgaW5pdCA9IHJlcXVpcmUoJy4vZGFzaGJvYXJkL2luaXQnKVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgaW5pdClcbiIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNtb2RlLWJ1dHRvbicpXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIC8vIERvIG5vdCB2YWxpZGF0ZSB0aGUgZm9ybVxuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuXG4gICAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0nKVxuXG4gICAgICBjb25zdCBwYXJhbWV0ZXJzID0gW1xuICAgICAgICBgdGFyZ2V0PSR7Zm9ybS50YXJnZXQudmFsdWV9YCxcbiAgICAgICAgYHJlYWRfdGltZW91dD0ke2Zvcm0ucmVhZF90aW1lb3V0LnZhbHVlfWBcbiAgICAgIF1cblxuICAgICAgaWYgKGZvcm0ucXVlcnkudmFsdWUpIHtcbiAgICAgICAgcGFyYW1ldGVycy5wdXNoKGBxdWVyeT0ke2VuY29kZVVSSUNvbXBvbmVudChmb3JtLnF1ZXJ5LnZhbHVlKX1gKVxuICAgICAgfVxuXG4gICAgICBpZiAobG9jYXRpb24ucGF0aG5hbWUuaW5jbHVkZXMoJ2V4cGVydCcpKSB7XG4gICAgICAgIGxvY2F0aW9uLmhyZWYgPSBgLz8ke3BhcmFtZXRlcnMuam9pbignJicpfWBcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvY2F0aW9uLmhyZWYgPSBgL2V4cGVydD8ke3BhcmFtZXRlcnMuam9pbignJicpfWBcbiAgICAgIH1cbiAgICB9KVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3BhcnNlLWl0LWJ1dHRvbicpXG5cbiAgaWYgKGJ1dHRvbikge1xuICAgIGJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBjb25zdCBmb3JtID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0nKVxuXG4gICAgICBpZiAoZm9ybS5jaGVja1ZhbGlkaXR5KCkpIHtcbiAgICAgICAgLy8gRG8gbm90IHN1Ym1pdCBmb3JtLlxuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgbG9jYXRpb24uaHJlZiA9IGAvZXhwZXJ0P3F1ZXJ5PSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZvcm0ucXVlcnkudmFsdWUpfSZ0YXJnZXQ9JHtmb3JtLnRhcmdldC52YWx1ZX0mcmVhZF90aW1lb3V0PSR7Zm9ybS5yZWFkX3RpbWVvdXQudmFsdWV9YFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9ybS5xdWVyeVNlbGVjdG9yKCcjcXVlcnknKVxuICAgICAgICAgIC5mb2N1cygpXG4gICAgICB9XG4gICAgfSlcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihjb25maWcpIHtcbiAgc2V0VGFyZ2V0RGlzcGxheShjb25maWcpXG4gIHNldE5scUZvcm1UYXJnZXQoY29uZmlnKVxuICBzZXRFbmRwb2ludChjb25maWcpXG4gIHVwZGF0ZUV4YW1wbGVRZXJpZXMoY29uZmlnKVxufVxuXG5mdW5jdGlvbiBzZXRUYXJnZXREaXNwbGF5KGNvbmZpZykge1xuICBpZiAoY29uZmlnWydob21lJ10pIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGFyZ2V0LWRpc3BsYXknKVxuICAgICAgLmlubmVySFRNTCA9IGBAPGEgaHJlZj1cIiR7Y29uZmlnWydob21lJ119XCI+JHtjb25maWdbJ25hbWUnXX08L2E+YFxuICB9IGVsc2Uge1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0YXJnZXQtZGlzcGxheScpXG4gICAgICAuaW5uZXJIVE1MID0gYEAke2NvbmZpZ1snbmFtZSddfWBcbiAgfVxufVxuXG5mdW5jdGlvbiBzZXRObHFGb3JtVGFyZ2V0KGNvbmZpZykge1xuICAvLyB0byBzZXR1cCB0YXJnZXQgaW4gTkxRIGZvcm1cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25scWZvcm0gaW5wdXRbbmFtZT1cInRhcmdldFwiXScpXG4gICAgLnZhbHVlID0gY29uZmlnLm5hbWVcbn1cblxuZnVuY3Rpb24gc2V0RW5kcG9pbnQoY29uZmlnKSB7XG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNlbmRwb2ludC11cmwnKVxuICAgIC52YWx1ZSA9IGNvbmZpZy5lbmRwb2ludF91cmxcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI25lZWQtcHJveHknKVxuICAgIC52YWx1ZSA9IChjb25maWcubmFtZSA9PT0gJ2Jpb2dhdGV3YXknKVxufVxuXG5mdW5jdGlvbiB1cGRhdGVFeGFtcGxlUWVyaWVzKGNvbmZpZykge1xuICBjb25zdCB7XG4gICAgc2FtcGxlX3F1ZXJpZXNcbiAgfSA9IGNvbmZpZ1xuICBjb25zdCBkb20gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuc2FtcGxlLXF1ZXJpZXMnKVxuXG4gIGlmIChzYW1wbGVfcXVlcmllcykge1xuICAgIGNvbnN0IGxpc3RJdGVtcyA9IHNhbXBsZV9xdWVyaWVzXG4gICAgICAubWFwKChxKSA9PiBgPGxpPjxhIGhyZWY9XCIjXCI+JHtxfTwvYT48L2xpPmApXG4gICAgICAuam9pbignJylcblxuICAgIGRvbS5pbm5lckhUTUwgPSBsaXN0SXRlbXNcbiAgfSBlbHNlIHtcbiAgICBkb20uaW5uZXJIVE1MID0gJydcbiAgfVxufVxuIiwiY29uc3QgYXBwbHlDb25maWcgPSByZXF1aXJlKCcuL2FwcGx5LWNvbmZpZycpXG5jb25zdCBzZXREaWN0aW9uYXJ5VXJsID0gcmVxdWlyZSgnLi9zZXQtZGljdGlvbmFyeS11cmwnKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKHRhcmdldCwgZWRpdG9yID0gbnVsbCkge1xuICBjb25zdCB1cmwgPSBgaHR0cDovL3RhcmdldHMubG9kcWEub3JnL3RhcmdldHMvJHt0YXJnZXR9YFxuICBjb25zdCByZXEgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKVxuXG4gIHJlcS5vbnJlYWR5c3RhdGVjaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5yZWFkeVN0YXRlID09PSBYTUxIdHRwUmVxdWVzdC5ET05FKSB7XG4gICAgICBpZiAodGhpcy5zdGF0dXMgPT0gMjAwKSB7XG4gICAgICAgIGNvbnN0IGNvbmZpZyA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZSlcbiAgICAgICAgYXBwbHlDb25maWcoY29uZmlnKVxuICAgICAgICBpZiAoZWRpdG9yKSB7XG4gICAgICAgICAgc2V0RGljdGlvbmFyeVVybChlZGl0b3IsIGNvbmZpZylcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5sb2coJ0dhdGV3YXkgZXJyb3IhJylcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmVxLm9wZW4oJ0dFVCcsIHVybClcbiAgcmVxLnNldFJlcXVlc3RIZWFkZXIoJ0FjY2VwdCcsICdhcHBsaWNhdGlvbi9qc29uJylcbiAgcmVxLnNlbmQoKVxufVxuIiwiY29uc3QgY2hhbmdlVGFyZ2V0ID0gcmVxdWlyZSgnLi9jaGFuZ2UtdGFyZ2V0Jylcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmluZFRhcmdldENoYW5nZUV2ZW50aGFuZGxlcihlZGl0b3IpIHtcbiAgLy8gYWRkIGV2ZW50IGxpc3RlbmVyc1xuICBjb25zdCBzZWxlY3RvciA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0YXJnZXQnKVxuICBpZihzZWxlY3Rvcikge1xuICAgIHNlbGVjdG9yLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIChlKSA9PiBjaGFuZ2VUYXJnZXQoZS50YXJnZXQudmFsdWUsIGVkaXRvcikpXG5cbiAgICAvLyBpbml0aWFsIHRhcmdldFxuICAgIGNoYW5nZVRhcmdldChzZWxlY3Rvci52YWx1ZSwgZWRpdG9yKVxuICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGVkaXRvciwgY29uZmlnKSB7XG4gIGNvbnN0IGRpY1VybCA9IGNvbmZpZy5kaWN0aW9uYXJ5X3VybFxuICBjb25zdCBwcmVkRGljVXJsID0gY29uZmlnLnByZWRfZGljdGlvbmFyeV91cmxcbiAgZWRpdG9yLnNldERpY3Rpb25hcnlVcmwoZGljVXJsLCBwcmVkRGljVXJsKVxufVxuIiwiLyogZ2xvYmFsIGdyYXBoRWRpdG9yICovXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICBpZiAod2luZG93LmdyYXBoRWRpdG9yKSB7XG4gICAgY29uc3QgZWRpdG9yID0gZ3JhcGhFZGl0b3IoJy90ZXJtZmluZGVyJylcblxuICAgIC8vIGluaXQgZ3JhcGhcbiAgICBlZGl0b3IuYWRkUGdwKEpTT04ucGFyc2UoZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2xvZHFhLXBncCcpXG4gICAgICAuaW5uZXJIVE1MKSlcblxuICAgIHJldHVybiBlZGl0b3JcbiAgfVxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgLy8gc2FtcGxlIHF1ZXJpZXNcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2J1dHRvbi1zaG93LXF1ZXJpZXMnKVxuICAgIC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgICBjb25zdCBlbGVtZW50ID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmV4YW1wbGVzJylcbiAgICAgIGlmIChlbGVtZW50LmNsYXNzTGlzdC5jb250YWlucygnZXhhbXBsZXMtLWhpZGRlbicpKSB7XG4gICAgICAgIGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnZXhhbXBsZXMtLWhpZGRlbicpXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2V4YW1wbGVzLS1oaWRkZW4nKVxuICAgICAgfVxuICAgIH0pXG5cbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnNhbXBsZS1xdWVyaWVzJylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3F1ZXJ5JylcbiAgICAgICAgLnZhbHVlID0gZS50YXJnZXQudGV4dFxuICAgICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmV4YW1wbGVzJylcbiAgICAgICAgLmNsYXNzTGlzdC5hZGQoJ2V4YW1wbGVzLS1oaWRkZW4nKVxuICAgIH0pXG59XG4iLCJjb25zdCBpbml0R3JwYWhFZGl0b3IgPSByZXF1aXJlKCcuL2luaXQtZ3JwYWgtZWRpdG9yJylcbmNvbnN0IGluaXRTYW1wbGVRdWVyaWVzID0gcmVxdWlyZSgnLi9pbml0LXNhbXBsZS1xdWVyaWVzJylcbmNvbnN0IGJpbmRQYXJzZUl0QnV0dG9uRXZlbnRoYW5kbGVyID0gcmVxdWlyZSgnLi9iaW5kLXBhcnNlLWl0LWJ1dHRvbi1ldmVudGhhbmRsZXInKVxuY29uc3QgYmluZFRhcmdldENoYW5nZUV2ZW50aGFuZGxlciA9IHJlcXVpcmUoJy4vYmluZC10YXJnZXQtY2hhbmdlLWV2ZW50aGFuZGxlcicpXG5jb25zdCBiaW5kTW9kZUJ1dHRvbkV2ZW50aGFuZGxlciA9IHJlcXVpcmUoJy4vYmluZC1tb2RlLWJ1dHRvbi1ldmVudGhhbmRsZXInKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICBpbml0U2FtcGxlUXVlcmllcygpXG4gIGJpbmRQYXJzZUl0QnV0dG9uRXZlbnRoYW5kbGVyKClcbiAgYmluZE1vZGVCdXR0b25FdmVudGhhbmRsZXIoKVxuXG4gIGNvbnN0IGVkaXRvciA9IGluaXRHcnBhaEVkaXRvcigpXG4gIGJpbmRUYXJnZXRDaGFuZ2VFdmVudGhhbmRsZXIoZWRpdG9yKVxufVxuIl19
