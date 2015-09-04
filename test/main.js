var inlineResize = require("../"),
    gulp = require("gulp"),
    should = require("should"),
    path = require("path"),
    assert = require("stream-assert"),
    File = require("gulp-util").File,
    gm = require("gm"),
    bufferEqual = require('buffer-equal'),
    should = require("should");

require("mocha");

var fixtures = function (glob) { return path.join(__dirname, "fixtures", glob); }

describe("gulp-inline-resize", function() {
  it("should pass through null files", function (done) {
    var stream = inlineResize();
    stream
      .pipe(assert.length(1))
      .pipe(assert.end(done));
    stream.write(new File());
    stream.end();
  });

  it("should emit error on streamed file", function (done) {
    gulp.src(fixtures("*"), { buffer: false })
      .pipe(inlineResize())
      .on("error", function (err) {
        err.message.should.eql("Streams are not supported!");
        done();
      });
  });

  it("should work with html without references", function (done) {
    gulp.src(fixtures("no-reference.html"))
      .pipe(inlineResize())
      .pipe(assert.end(done));
  })

  it("should change references in the html", function (done) {
    gulp.src(fixtures("reference-1.html"))
      .pipe(inlineResize())
      .pipe(assert.first(function(file) {
        file.contents.toString("utf8").should.containEql('"image-200w.jpg"');
      }))
      .pipe(assert.end(done));
  })

  it("should resize a referenced image", function (done) {
    gulp.src([fixtures("reference-1.html"),fixtures("image.jpg")])
      .pipe(inlineResize())
      .pipe(assert.all(function(file) {
        if (path.extname(file.relative)==".jpg") {
          gm(file.contents,file.path)
            .options({imageMagick: true})
            .size({bufferStream: true}, function(err, size) {
              (err === undefined).should.be.true;
              size.width.should.be.eql(200);
              done();
            })
        }
      }))
      .pipe(assert.end());
  })

  it("should work with subfolders", function (done) {
    var i = 0, b1=null;
    gulp.src([fixtures("nested-reference-1.html"),fixtures("**/image.jpg")])
      .pipe(inlineResize())
      .pipe(assert.length(3))
      .pipe(assert.all(function(file) {
        if (path.extname(file.relative)==".jpg") {
          gm(file.contents,file.path)
            .options({imageMagick: true})
            .size({bufferStream: true}, function(err, size) {
              (err === undefined).should.be.true;
              size.width.should.be.eql(200);
              i+=1;
              if (i==2) {
                bufferEqual(file.contents, b1).should.be.false;
                done();
              }
              b1 = file.contents;
            })
        }
      }))
      .pipe(assert.end());
  })

  it("should resize a referenced image if it referenced from two files", function (done) {
    gulp.src([fixtures("reference-1.html"),fixtures("reference-2.html"),fixtures("image.jpg")]).on('error',console.log)
      .pipe(inlineResize())
      .pipe(assert.length(4)) // two html files, two versions of the image
      .pipe(assert.end(done));
  })

  it("should resize a referenced image and still leave the original if it's requested too", function (done) {
    gulp.src([fixtures("resized-and-original.html"),fixtures("image.jpg")]).on('error',console.log)
      .pipe(inlineResize())
      .pipe(assert.length(3)) // one html file, two versions of the image
      .pipe(assert.end(done));
  })

  it("should cache images accross different pipes", function (done) {
    gulp.src([fixtures("reference-1.html"),fixtures("image.jpg")]).on('error',console.log)
      .pipe(inlineResize())
      .pipe(assert.end(next));

    function next() {
      should(Object.keys(inlineResize._getCache())).with.lengthOf(2);
      gulp.src([fixtures("reference-2.html"),fixtures("image.jpg")]).on('error',console.log)
        .pipe(inlineResize())
        .pipe(assert.end(next2));
    }

    function next2() {
      should(Object.keys(inlineResize._getCache())).with.lengthOf(2);
      inlineResize.setMaxCacheAge(1)

      gulp.src([fixtures("reference-1.html"),fixtures("image.jpg")]).on('error',console.log)
        .pipe(inlineResize())
        .pipe(assert.end(next3));
    }

    function next3() {
      should(Object.keys(inlineResize._getCache())).with.lengthOf(4);

      gulp.src([fixtures("reference-1.html"),fixtures("image.jpg")]).on('error',console.log)
        .pipe(inlineResize())
        .pipe(assert.end(next4));
    }

    function next4() {
      should(Object.keys(inlineResize._getCache())).with.lengthOf(2);
      inlineResize.setMaxCacheAge(0);
      done();
    }
  })

});