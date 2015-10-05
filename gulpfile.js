var gulp = require('gulp'),
  babel = require("gulp-babel"),
  src = 'src/js/',
  js = 'lodqa-client.js',
  dist = 'public/js/'

gulp
  .task('browserify', function() {
    var browserify = require('gulp-browserify')

    gulp.src(src + js)
      .pipe(browserify())
      .pipe(gulp.dest(dist))
  })
  .task('babel', function() {
    return gulp.src(src + 'subboard.js')
      .pipe(babel())
      .pipe(gulp.dest(dist))
  })
  .task('auto_compile', function() {
    gulp.watch(src + '**', ['browserify'])
    gulp.watch(src + 'subboard.js', ['babel'])
  })
  .task('default', ['browserify', 'babel', 'auto_compile'])
