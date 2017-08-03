const gulp = require('gulp')
const browserify = require('gulp-browserify')
const debug = require('gulp-debug')

const src = 'src/js/'
const dist = 'public/js/'

gulp
  .task('browserify', () => gulp
    .src([`${src}lodqa-client.js`, `${src}execute.js`])
    .pipe(debug({title: 'unicorn:'}))
    .pipe(browserify())
    .pipe(gulp.dest(dist))
  )
  .task('auto_compile', () => {
    gulp.watch(src + '**', ['browserify'])
    gulp.watch(src + 'index.js', ['copy'])
    gulp.watch(src + 'dashboard.js', ['copy'])
  })
  .task('default', ['browserify', 'auto_compile'])
