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
  return gulp.src("./src/**.+(html|css|jpg|png)")
    .pipe(inlineResize({replaceIn:[".html",".css"]}))
    .pipe(gulp.dest("./build"));
});

```

## What do I need to do in order to make it work?

If you're using _relative_ paths to refer to your images it hopefully will work out of the box for you. The trickiest part to get right at the moment is mapping the file references to the correct image. This plugin assumes that if you were to `gulp.dest()` the input of this plugin that the resulting files would correctly reference each other via.

There currently is no support for absolute paths yet.

## Options

* `replaceIn` default: `[".html",".css",".js"]`
  a list of extensions that indicates which files will be analysed for image references

* `noZoom` default: `true`
  determines if images get enlarged if the source image is smaller than the target size.

* `useImageMagick` default: `true`
tells [gm](https://github.com/aheckmann/gm) the value of the `imageMagick` option. Setting this option to `false` would result in using `GraphicsMagick`

* `quiet` default: `false`
this plugin is quite chatty keeping you informed about what it found and did, surpress any log messages by setting this option

## Requirements

Either [GraphicsMagick](http://www.graphicsmagick.org/) or [ImageMagick](http://www.imagemagick.org/) need to be installed (and tell which one you use via the `useImageMagick` option). Otherwise you might get a mysterious `spawn` error from node.

## License

ISC © Daniel Berndt