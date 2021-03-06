[![build status](https://img.shields.io/travis/danielberndt/gulp-inline-resize.svg?style=flat-square)](https://travis-ci.org/danielberndt/gulp-inline-resize)
[![dependency status](https://img.shields.io/david/danielberndt/gulp-inline-resize.svg?style=flat-square)](https://david-dm.org/danielberndt/gulp-inline-resize)

# GULP-INLINE-RESIZE

_put your resize information in your code, not your build file_

## What's this plugin about?

On the surface it's quite simple: This plugin allows you to reference your images like this:

```html
<div class="logo">
  <img src="./images/logo.png;80h" srcset="./images/logo.png;80h 1x, ./images/logo.png;160h 2x" alt="logo">
  <img src="./images/banner.jpg;320w" srcset="./banner.jpg;320w 1x, ./banner.jpg;640w 2x" alt="banner">
</div>
```

or

```css
.logo {
  height:80px;
  background-image: url(./images/logo.png;80h);
  background-size: 160px 80px;
}
@media only screen and (min-device-pixel-ratio: 2) {
  .logo {
    background-image: url(./images/logo.png;160h);
  }
}
```

As you can see all there needs to be done is to put `;pixels(h|w)` behind your image references and the plugin will take care of the rest:

* analysing the path to infer which image was meant
* replacing the reference-string with something like `./images/logo-80h.png`
* converting the image and push it to the gulp-stream under it's new name
* caching the results in RAM to allow fast development cycles

It only allows to either set the height constraint `h` or width constraint `w`. The plugin will infer the other dimension by keeping the aspect ratio intact. There is no way to change the aspect ratio of your images using the plugin.

This plugin works entirely with Buffers, that is, no files are read from or written to disk. This allows for powerful chaining within the streams.

## How do I install it?

`npm install --save-dev gulp-inline-resize`

## How do I use it in my gulpfile?

here's a very short example:

```js
var gulp = require("gulp"),
    inlineResize = require("gulp-inline-resize");

gulp.task("resize-images", function() {
  return gulp.src("./src/**/*.+(html|css|jpg|png)")
    .pipe(inlineResize({replaceIn:[".html",".css"]}))
    .pipe(gulp.dest("./build"));
});

```

this is a more complete example showing varying stream operations:

```js
var gulp = require("gulp"),
    inlineResize = require("gulp-inline-resize"),
    less = require("gulp-less"),
    imagemin = require("gulp-imagemin"),
    cssmin = require("gulp-cssmin"),
    merge = require("merge-stream"),
    filter = require("gulp-filter");

var CONFIG = {
  htmlSrc: "src/**/*.html",
  lessEntry: "src/style.less",
  lessSrc: "src/**/*.less",
  imgSrc: "src/**/*.+(jpg|png|gif)"
};

function getAssetStream() {
  var htmlStream = gulp.src(CONFIG.htmlSrc),
      cssStream = gulp.src(CONFIG.lessEntry)
        .pipe(less())
        .on('error',console.log),
      imageStream = gulp.src(CONFIG.imgSrc);

  return merge(htmlStream, cssStream, imageStream)
          .pipe(inlineResize());
}

gulp.task("dev-assets", function() {
  return getAssetStream()
    .pipe(gulp.dest("build"));
});

gulp.task("watch", ["dev-assets"], function() {
  gulp.watch([
    CONFIG.htmlSrc,
    CONFIG.lessSrc,
    CONFIG.imgSrc
  ], ["dev-assets"]);
});

gulp.task("prod-assets", function() {
  var cssFilter = filter("**/*.css"),
      imgFilter = filter("**/*.+(jpg|png|gif)");

  return getAssetStream()
    .pipe(cssFilter)
    .pipe(cssmin())
    .pipe(cssFilter.restore())
    .pipe(imgFilter)
    .pipe(imagemin({progressive: true}))
    .pipe(imgFilter.restore())
    .pipe(gulp.dest("dist"));
});

gulp.task("default",["watch"]);
```

## What do I need to do in order to make it work?

If you're using _relative_ paths to refer to your images it hopefully will work out of the box for you. The trickiest part to get right at the moment is mapping the file references to the correct image. This plugin assumes that if you were to `gulp.dest()` the input of this plugin that the resulting files would correctly reference each other via.

There currently is no support for absolute paths yet.

## Options

#### `replaceIn`

default: `[".html",".css",".js"]`

a list of extensions that indicates which files will be analysed for image references

#### `noZoom`

default: `true`

determines if images get enlarged if the source image is smaller than the target size.

#### `useImageMagick`

default: `true`

tells [gm](https://github.com/aheckmann/gm) the value of the `imageMagick` option. Setting this option to `false` would result in using `GraphicsMagick`

#### `quiet`

default: `false`

this plugin is quite chatty keeping you informed about what it found and did, surpress any log messages by setting this option

#### `naiveCache`

default: `{destFolder: null}`

usage: `.pipe(inlineResize({naiveCache: {destFolder: "build"}}))`

if you provide a destination folder, this option will look inside this folder to check whether a file with the target file name exists.

Why *naive* cache, you might ask?

Well, since the inline resizer is operating within streams, it doesn't know what happens to the files after it processed them. You could decide to rename them or put them into a sprite sheet. In those cases this option doesn't work.

However it's very useful for simple setups with lots of images since it will speed up the initial processing speed considerably.


## Global Options

Global options should be applied at the top of your gulpfile. These options will affect all `inlineResize()` operations.

You can call them like this:

```
var gulp = require("gulp"),
    inlineResize = require("gulp-inline-resize");

inlineResize.setMaxCacheAge(50);

gulp.task("resize-images", function() {
[...]

```


#### `setMaxCacheAge(val = 0)`

*hint: only needed if you have several streams using the inline resize functionality (see [issue #3](/../../issues/3) for more details)*

This sets the longevity of items in the cache.
With the default setting of `0` items will immediately be cleared from the cache if they have not been found once in the previous run.

If you set a higher cache age, items will stay in the cache much longer.

If you set a negative age, items will always be deleted from the cache.

## Bonus Time!

Incorporating the default image processing options described in [this smashing magazine article](http://www.smashingmagazine.com/2015/06/25/efficient-image-resizing-with-imagemagick/) the resulting image size is considerably smaller (~50% for jpgs) than the default resize of [gm](https://github.com/aheckmann/gm).


## Requirements

Either [GraphicsMagick](http://www.graphicsmagick.org/) or [ImageMagick](http://www.imagemagick.org/) need to be installed (and tell which one you use via the `useImageMagick` option). Otherwise you might get a mysterious `spawn` error from node.

## Contribute

Contributions are very welcome.

Those steps should get you up and running:

```
git clone git@github.com:danielberndt/gulp-inline-resize.git
cd gulp-inline-resize
npm install
npm test
```

## License

ISC © Daniel Berndt