module.exports = function (checkboxDomId, progressBarPresentation){
  document.querySelector(`#${checkboxDomId}`)
    .addEventListener('click', () => progressBarPresentation.toggleShowOnlyHasAnswers())
}
