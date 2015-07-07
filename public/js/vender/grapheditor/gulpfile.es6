import gulp from 'gulp'
import connect from 'gulp-connect'

gulp.task('connect', () => connect.server({
  port: 9292,
  middleware: (connect, opt) => {
    return [(req, res, next) => {
      let response = {
        "genes": ["http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseasome/genes"],
        "alzheimer disease": ["http://www4.wiwiss.fu-berlin.de/diseasome/resource/diseases/74"]
      }
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(response))
      next()
    }]
  }
}))

gulp.task('default', ['connect'])
