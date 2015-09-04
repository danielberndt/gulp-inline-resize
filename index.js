var path = require("path"),
    through = require("through2"),
    gutil = require("gulp-util"),
    merge = require("merge"),
    path = require("path"),
    contains = require("lodash.contains"),
    gm = require("gm"),
    Q = require("q"),
    fs = require("fs"),
    adler32 = require("adler32");

var PluginError = gutil.PluginError;

var PLUGIN_NAME = "inline-resize";

var filepathRegex = /(?:\'|\"|\(|\s|&#x27;)((?!\s)[ a-z0-9_@\-\/\.]{2,}\.(?:jpe?g|gif|png))(?:;(\d+)([wh]))?/ig;

var CACHE = {},
    iteration = 0;

module.exports = function(opts) {
  var options = merge({
    replaceIn:[".html",".css",".js"],
    noZoom: true,
    useImageMagick: true,
    quiet: false
  },opts);

  function log() {
    if (options.quiet) return;
    var args = [].slice.call(arguments);
    gutil.log.apply(this,[PLUGIN_NAME+":"].concat(args));
  }

  function searchAndReplaceImages(file) {
    var cacheKey = file.relative+"-"+adler32.sum(file.contents),
        cacheEntry = CACHE[cacheKey];

    if (cacheEntry) {
      cacheEntry.iteration = iteration;
      file.contents = cacheEntry.content.replaced;
      return cacheEntry.content.processesables;
    }

    log("Finding references in [", gutil.colors.magenta(file.path),"]");
    var processesables = {};
    var replaced = file.contents.toString("utf8").replace(filepathRegex, function(match, fullPath, resizeTo, resizeDimension){
      // resizeTo = 200, resizeDimenstion = 'w'
      if (!resizeDimension) resizeDimension = "noResize";
      var imgPath = path.relative(file.base,path.resolve(file.base, fullPath));
      imgPath = path.join(path.dirname(file.relative), imgPath);

      var variants = (processesables[imgPath] = processesables[imgPath] || {});
      var dimensionVariants = (variants[resizeDimension] = variants[resizeDimension] || {});
      if (resizeDimension === "noResize") return match;

      dimensionVariants[resizeTo] = true;
      var newName = path.join(path.dirname(fullPath),path.basename(fullPath,path.extname(fullPath))+"-"+resizeTo+resizeDimension+path.extname(fullPath));
      return match.substr(0,match.indexOf(fullPath))+newName;
    });
    file.contents = new Buffer(replaced);
    log("Found [", gutil.colors.green(Object.keys(processesables).join(", ")),"]");
    CACHE[cacheKey] = {content: {replaced: file.contents, processesables: processesables}, iteration: iteration};
    return processesables;
  }

  // takes old file description and creates new file using new buffer
  function createNewVinylFile(oldFile, buffer, resizeTo, resizeDimension) {
    var oldPath = oldFile.path,
        extname = path.extname(oldPath);

    return new gutil.File({
      cwd: oldFile.cwd,
      base: oldFile.base,
      path: path.join(
        path.dirname(oldPath),
        path.basename(oldPath,extname)+"-"+resizeTo+resizeDimension+extname
      ),
      contents: buffer
    });
  }

  return through.obj(function(file, enc, cb) {
    this._processables = (this._processables||{});
    this._images = (this._images||[]);

    if (file.isNull()) return cb(null, file);
    if (file.isStream()) {
      this.emit("error", new PluginError(PLUGIN_NAME, "Streams are not supported!"));
      return cb();
    }

    var extname = path.extname(file.path);

    if (contains(options.replaceIn, extname)) {
      merge.recursive(this._processables,searchAndReplaceImages(file));
      cb(null, file);
    } else if (contains([".jpg",".png",".gif",".jpeg"], extname)){
      this._images.push(file);
      // don't process them yet, first we need to wait for all files to see how images
      // need to be converted
      cb(null);
    } else {
      cb(null, file);
    }
  },
  // flush -- called once all files have been passed through
  function(cb) {
    if (!this._images || this._images.length===0) return cb();
    var that = this,
        gmPromises = [];

    this._images.forEach(function(imageFile) {


      // variants looks like this: {'w':{250: true, 150:true}, 'h': {100:true}}
      var variants = that._processables[imageFile.relative];

      // if no variants found, just push the original file
      if (!variants) return that.push(imageFile);

      Object.keys(variants).forEach(function(resizeDimension) {
        if (resizeDimension === "noResize") return that.push(imageFile);

        Object.keys(variants[resizeDimension]).forEach(function(resizeTo) {
          resizeTo = parseInt(resizeTo,10);

          var deferred = Q.defer();

          // check for last modification date
          fs.stat(imageFile.path, function(err, stats) {
            if (err) return deferred.reject(new Error(err));
            var cacheKey = imageFile.relative+"-"+stats.mtime.getTime()+resizeDimension+resizeTo;

            // if it's cached push it right away
            var cacheEntry = CACHE[cacheKey];
            if (cacheEntry) {
              cacheEntry.iteration = iteration;
              that.push(createNewVinylFile(imageFile, cacheEntry.content, resizeTo, resizeDimension));
              deferred.resolve();
            } else {
              gm(imageFile.contents,imageFile.path)
                .options({imageMagick: options.useImageMagick})
                .size({bufferStream: true}, function(err, size) {
                  if (err) return deferred.reject(new Error(err));
                  if (options.noZoom) {
                    if (resizeDimension=="w" && resizeTo>=size.width ||
                      resizeDimension=="h" && resizeTo>=size.height) {
                      log("No need to resize [",
                        gutil.colors.yellow(imageFile.relative),
                        "] to",
                        gutil.colors.green(resizeTo+resizeDimension),
                        "since it's too small:",
                        gutil.colors.yellow(size.width+"x"+size.height)
                      );
                      CACHE[cacheKey] = {content: imageFile.contents, iteration: iteration};
                      that.push(createNewVinylFile(imageFile, imageFile.contents, resizeTo, resizeDimension));
                      return deferred.resolve();
                    }
                  }
                  this.resize(
                    resizeDimension=="w"? resizeTo : 10000,
                    resizeDimension=="h"? resizeTo : 10000
                  ).toBuffer(function(err, buffer) {
                    if (err) return deferred.reject(new Error(err));
                    log("Resized [",
                      gutil.colors.cyan(imageFile.relative),
                      "] to",
                      gutil.colors.green(resizeTo+resizeDimension),
                      gutil.colors.gray("saving "+((imageFile.contents.length-buffer.length)/imageFile.contents.length*100).toFixed(2)+"%")
                    );
                    CACHE[cacheKey] = {content: buffer, iteration: iteration};
                    that.push(createNewVinylFile(imageFile, buffer, resizeTo, resizeDimension));
                    deferred.resolve();
                  });
                });
            }
          });
          gmPromises.push(deferred.promise);
        });
      });
    });
    Q.all(gmPromises).then(
      function(results) {cb();},
      function(err) {cb(err,new PluginError(err));}
    ).fin(function() {
      Object.keys(CACHE).forEach(function(cacheKey) {
        var cacheEntry = CACHE[cacheKey];
        if (cacheEntry.iteration<iteration) {
          log("deleted cache entry for [", gutil.colors.gray(cacheKey),"]");
          delete CACHE[cacheKey];
        }
      });
      iteration+=1;
    });
  });
};
