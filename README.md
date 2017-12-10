[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]

Font Awesome Minify Plugin
--------------------------
A [Webpack](https://webpack.js.org/) Plugin that minifies your included [FontAwesome 5](http://fontawesome.com/) CSS and fonts by only bundling the icons you are actually using.

**Notice**: If you are using FontAwesome 4.x, you should be using version _0.1_ of this plugin!

# Install
```
npm install --save-dev font-awesome-minify-plugin
# or
yarn add --dev font-awesome-minify-plugin
```

# Usage
```javascript
const FontAwesomeMinifyPlugin = require("font-awesome-minify-plugin");

module.exports = {
  // ...
  plugins: [
    // ...
    new FontAwesomeMinifyPlugin({
      srcDir: helpers.root("app/")
    })
  ]
}
```

TypeScript example:

```typescript
import "@fortawesome/fontawesome-free-webfonts/css/fontawesome.css";
import "@fortawesome/fontawesome-free-webfonts/css/fa-regular.css";
import "@fortawesome/fontawesome-free-webfonts/css/fa-solid.css";
import "@fortawesome/fontawesome-free-webfonts/css/fa-brands.css";
```

# Options
```js
new FontAwesomeMinifyPlugin(options: object)
```

|Name                   |Type             |Default                      |Description                                                                                                |
|:--------------:       |:---------------:|:----------------------------|:----------------------------------------------------------------------------------------------------------|
|**`additionalClasses`**|`{Array<String>}`|[]                           |Additional FontAwesome CSS classes that should be included regardless of whether they occur or not         |
|**`blacklist`**        |`{Array<String>}`|All non-icon classes         |CSS Classes that are prohibited from being included                                                        |
|**`prefix`**           |`{String}`       |`fa`                         |The icon prefix                                                                                            |
|**`srcDir`**           |`{String}`       |`./`                         |Determines the folder in which to look for the usage of FontAwesome classes, see `globPattern` as well     |
|**`globPattern`**      |`{String}`       |`**/*`                       |Determines the [glob](https://github.com/isaacs/node-glob) pattern that determines which files are analyzed|
|**`debug`**            |`{Boolean}`      |`false`                      |Print additional debug information|

# How it works
The plugin hooks into the process of Webpack's module resolution and when a file matching any of FontAwesome's CSS filenames is found it does the following:

1. Detect all used icons (using the `prefix`, `globPattern` and `srcDir` options)
2. Depending on the type of the detected CSS file (either the "fontawesome.css" which contains all codepoints, or a style file, such as "fa-brands.css")
    1. Main file ("fontawesome.css"): Build a new CSS file that only contains the used codepoints
    2. Style file (e.g. "fa-brands.css"):
        1. Extract the SVG path from the file and build a new SVG, containing only the used glyphs
        2. Create a new CSS file pointing to the new SVG file
4. Replace the resolved CSS files with the new, temporary CSS files

# Acknowledgments
I would like to express my gratitude towards these projects:

- [svg2ttf](https://github.com/fontello/svg2ttf)
- [ttf2eot](https://github.com/fontello/ttf2eot)
- [ttf2woff](https://github.com/fontello/ttf2woff)
- [ttf2woff2](https://github.com/nfroidure/ttf2woff2)
- [xml2js](https://github.com/Leonidas-from-XIV/node-xml2js)

Without them, this plugin wouldn't be possible.

Thanks to the people behind the awesome [FontAwesome](http://fontawesome.io/) library as well!

[npm]: https://img.shields.io/npm/v/font-awesome-minify-plugin.svg
[npm-url]: https://npmjs.com/package/font-awesome-minify-plugin

[node]: https://img.shields.io/node/v/font-awesome-minify-plugin.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/dhardtke/font-awesome-minify-plugin.svg
[deps-url]: https://david-dm.org/dhardtke/font-awesome-minify-plugin
