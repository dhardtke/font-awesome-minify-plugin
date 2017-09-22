[![npm][npm]][npm-url]
[![node][node]][node-url]
[![deps][deps]][deps-url]

Font Awesome Minify Plugin
--------------------------
A [Webpack](https://webpack.js.org/) Plugin that minifies your included [FontAwesome](http://fontawesome.io/) CSS and fonts by only bundling the icons you are actually using.

# Install
```
npm install --save-dev font-awesome-minify-plugin
# or
yarn add dev font-awesome-minify-plugin
```

# Usage
```javascript
const FontAwesomeMinifyPlugin = require("font-awesome-minify-plugin");

module.exports = {
  // ...
  plugins: [
    // ...
    new FontAwesomeMinifyPlugin({
      srcDir: helpers.root("app/"),
      faSvg: helpers.root("node_modules/font-awesome/fonts/fontawesome-webfont.svg")
    })
  ]
}
```

# Options
```js
new FontAwesomeMinifyPlugin(options: object)
```

|Name                   |Type             |Default                      |Description                                                                                                |
|:--------------:       |:---------------:|:----------------------------|:----------------------------------------------------------------------------------------------------------|
|**`cssPattern`**       |`{Regexp}`       |`/font-awesome\.(min\.)?css/`|The regular expression pattern that determines the file to be processed                                    |
|**`additionalClasses`**|`{Array<String>}`|[]                           |Additional FontAwesome CSS classes that should be included regardless of whether they occur or not         |
|**`blacklist`**        |`{Array<String>}`|All non-icon classes         |CSS Classes that are prohibited from being included                                                        |
|**`prefix`**           |`{String}`       |`fa`                         |The icon prefix                                                                                            |
|**`srcDir`**           |`{String}`       |`./`                         |Determines the folder in which to look for the usage of FontAwesome classes, see `globPattern` as well     |
|**`globPattern`**      |`{String}`       |`**/*`                       |Determines the [glob](https://github.com/isaacs/node-glob) pattern that determines which files are analyzed|
|**`debug`**            |`{Boolean}`      |`false`                      |Print additional debug information|
|**`faSvg`**            |`{String}`       |`""`                         |The path to the SVG file of FontAwesome|

# How it works
The plugin hooks into the process of Webpack's module resolution and when a file matching the provided `cssPattern` is found it does the following:

1. Detect all used icons (using the `prefix`, `globPattern` and `srcDir` options)
2. For each used icon:
    1. Find the icon's glyph in FontAwesome's SVG file (using the `faSvg` option)
    2. Construct a string containing the SVG and CSS statements for the current icon
3. Write the SVG to a temporary file, convert it to a ttf, woff, eot and woff2 file
4. Replace the resolved CSS file with a new, temporary CSS file, which points to the previously created font files

# Acknowledgments
I would like to express my gratitude towards these projects:

- [svg2ttf](https://github.com/fontello/svg2ttf)
- [ttf2eot](https://github.com/fontello/ttf2eot)
- [ttf2woff](https://github.com/fontello/ttf2woff)
- [ttf2woff2](https://github.com/nfroidure/ttf2woff2)

Without them, this plugin wouldn't be possible.

Thanks to the people behind the awesome [FontAwesome](http://fontawesome.io/) library as well!

[npm]: https://img.shields.io/npm/v/font-awesome-minify-plugin.svg
[npm-url]: https://npmjs.com/package/font-awesome-minify-plugin

[node]: https://img.shields.io/node/v/font-awesome-minify-plugin.svg
[node-url]: https://nodejs.org

[deps]: https://david-dm.org/dhardtke/font-awesome-minify-plugin.svg
[deps-url]: https://david-dm.org/dhardtke/font-awesome-minify-plugin
