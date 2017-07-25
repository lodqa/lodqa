const gulp = require('gulp')
const babel = require('gulp-babel')
const browserify = require('gulp-browserify')
const debug = require('gulp-debug')
const src = 'src/js/'
const dist = 'public/js/'

gulp
  .task('browserify', () => gulp
    .src([`${src}lodqa-client.js`, `${src}execute.js`])
    .pipe(debug({title: 'unicorn:'}))
    .pipe(browserify({
      transform: ['babelify']
    }))
    .pipe(gulp.dest(dist))
  )
  .task('babel', () => gulp
    .src([`${src}index.js`, `${src}dashboard.js`])
    .pipe(babel())
    .pipe(gulp.dest(dist))
  )
  .task('auto_compile', () => {
    gulp.watch(src + '**', ['browserify'])
    gulp.watch(src + 'index.js', ['babel'])
    gulp.watch(src + 'dashboard.js', ['babel'])
  })
  .task('default', ['browserify', 'babel', 'auto_compile'])
