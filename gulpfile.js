var browserify = require('gulp-browserify'),
    concat = require('gulp-concat'),
    // connect = require('gulp-connect'),
    gulp = require('gulp'),
    open = require('gulp-open'),
    plumber = require('gulp-plumber'),
    livereload = require('gulp-livereload'),
    webpack = require('gulp-webpack'),
    closureCompiler = require('google-closure-compiler').gulp();

gulp
  // performs magic
  .task('webpack', function(){
    gulp.src('./client/index.js')
      .pipe(plumber())
      .pipe(webpack())
      .pipe(concat('mongodb-browser.js'))
      .pipe(plumber.stop())
      .pipe(gulp.dest('dist'))
      .pipe(livereload());
  })

  // performs magic
  .task('closure', function(){
    gulp.src('./client/index.js')
      .pipe(plumber())
      .pipe(webpack())
      .pipe(concat('mongodb-browser.js'))
      .pipe(closureCompiler({
        compilation_level: 'SIMPLE',
        warning_level: 'QUIET', // QUIET, DEFAULT, VERBOSE
        language_in: 'ECMASCRIPT6_STRICT',
        language_out: 'ECMASCRIPT5_STRICT',
        output_wrapper: '(function(){\n%output%\n}).call(this)',
        js_output_file: 'mongodb-browser-closure.js'
      }))
      .pipe(plumber.stop())
      .pipe(gulp.dest('dist'))
      .pipe(livereload());
  })

  // moves source files to dist
  .task('copy', function(){
    gulp
      .src('client/index.html')
      .pipe(gulp.dest('dist'));

     gulp
      .src('client/assets/**/*.*')
      .pipe(gulp.dest('dist/assets'));

     gulp
      .src('client/img/**/*.*')
      .pipe(gulp.dest('dist/img'));
  })

  // // local development server
  // .task('connect', function(){
  //   connect.server({
  //     root: ['dist'],
  //     port: '8080',
  //     base: 'http://localhost',
  //     livereload: true
  //   });
  // })

  // build the application
  .task('default', ['webpack', 'copy'])

  // watch for source changes
  .task('watch', ['default'], function(){
    livereload.listen();
    gulp.watch('client/**/*.*', ['default']);
  });
