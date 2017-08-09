// Create an array of non-duplicate URLs
// The solutions is a array of object.
// Each object has id of nodes as key and url of nodes as value.
// For example:
// [
//   {
//     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1438",
//     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   },
//   {
//     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1884",
//     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   },
//   {
//     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/1885",
//     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   },
//   {
//     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/239",
//     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   },
//   {
//     "it1": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/83",
//     "st1": "http://www.w3.org/1999/02/22-rdf-syntax-ns#type",
//     "p01": "http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/associatedGene"
//   }
// ]
module.exports = function(solutions) {
  return Array.from(
    new Set(solutions.reduce(
      (array, solution) => {
        for (const url of Object.values(solution)) {
          array.push(url)
        }
        return array
      }, []))
  )
}
