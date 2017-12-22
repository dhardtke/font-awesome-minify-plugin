const glob = require("glob");
const fs = require("fs");
const path = require("path");
const os = require("os");
const rimraf = require("rimraf");

const xml2js = require("xml2js");

const svg2ttf = require("svg2ttf");
const ttf2woff = require("ttf2woff");
const ttf2eot = require("ttf2eot");
const ttf2woff2 = require("ttf2woff2");

const utils = require("./utils");

class FontAwesomeMinifyPlugin {
    constructor(options) {
        this.options = Object.assign({}, {
            additionalClasses: [],
            blacklist: ["fw", "2x", "3x", "4x", "5x", "lg", "spin", "pull-left", "pull-right", "rotate", "rotate-90", "rotate-180", "rotate-270",
                "regular", "solid", "brands"],
            prefix: "fa",
            srcDir: "./",
            globPattern: "**/*",
            debug: false
        }, options);
    }

    /**
     * Finds the used icon classes, starting with options.prefix in all files matching options.globPattern inside options.srcDir.
     * @return {Array}
     */
    findUsedIconClasses() {
        const usedIconClasses = [];

        const files = glob.sync(this.options.globPattern, {
            cwd: this.options.srcDir,
            nosort: true,
            nodir: true,
            absolute: true
        });

        const pattern = new RegExp(`${this.options.prefix}-([\\w-]+)`, "g");

        for (const file of files) {
            const contents = fs.readFileSync(file, "utf8");

            let match;
            while (match = pattern.exec(contents)) {
                const iconClass = match[1];

                if (this.options.blacklist.indexOf(iconClass) < 0 && usedIconClasses.indexOf(iconClass) < 0) {
                    usedIconClasses.push(iconClass);
                }
            }
        }

        if (this.options.debug) {
            console.info(`Detected ${usedIconClasses.length} icons: [${usedIconClasses.join(", ")}]`);
        }

        return usedIconClasses;
    }

    /**
     * Extracts the path to file with the given extension referred to in the given CSS source code.
     * @param extension the extension of the file to look for, without a dot
     * @param cssSource the CSS source code to look in
     * @return string the path to the file
     */
    static extractFilePath(extension, cssSource) {
        const end = cssSource.indexOf(`.${extension}`);

        let begin = end;

        do {
            begin--;
        } while (begin > 0 && cssSource.charAt(begin) !== "'" && cssSource.charAt(begin) !== "\"");

        return cssSource.substring(begin + 1, end + 1 + extension.length);
    }

    /**
     * Processes the main css file, usually "fontawesome.css":
     * Creates and writes a new CSS file only containing the codepoints for the used icons.
     * @param sourceCode
     * @param usedIcons
     * @param resource
     * @param context
     * @param tempFileCallback
     */
    processMainCss(sourceCode, usedIcons, resource, context, tempFileCallback) {
        // build new CSS
        let cssSource = sourceCode.match(/([^]*fa-inverse\s*{[^]*?})/)[1]; // use everything before and including .fa-inverse as base
        for (const icon of usedIcons) {
            const iconClass = `${this.options.prefix}-${icon}`;
            // TODO use CSS parser / builder
            const codepointMatches = sourceCode.match(new RegExp(`\\.${iconClass}:before.*?{\\s*content:\\s*"\\\\(\\w+)";?\\s*}`));
            if (codepointMatches) {
                cssSource += `.${iconClass}:before{content:"\\${codepointMatches[1]}"}`;
            } else if (this.options.debug) {
                console.warn(`Couldn't find codepoint for ${iconClass} inside ${resource}`);
            }
        }

        // write css to temp file inside temp dir and change context / resource
        tempFileCallback(path.basename(resource), cssSource, true);
    }

    /**
     * Processes a CSS file for a style variant of FontAwesome, e.g. "fa-brands.css":
     * Creates and writes a new SVG file only containing the glyphs that are used. Based on that SVG file, a TTF, EOT, WOFF and WOFF2 file is generated.
     * @param sourceCode
     * @param usedIcons
     * @param resource
     * @param context
     * @param tempFileCallback
     */
    processStyleCss(sourceCode, usedIcons, resource, context, tempFileCallback) {
        // read normalized svg path
        const svgPath = FontAwesomeMinifyPlugin.extractFilePath("svg", sourceCode);
        const svgPathAbs = path.normalize(path.join(context, svgPath));

        if (!fs.existsSync(svgPathAbs)) {
            if (this.options.debug) {
                console.info(`Ignoring non-existing SVG path ${svgPath}`);
            }

            return;
        }

        // read and parse SVG
        const parser = new xml2js.Parser({
            async: false
        });

        const data = fs.readFileSync(svgPathAbs, "utf8");

        parser.parseString(data, (err, result) => {
            // copy the glyphs from the parsed SVG and use them as source
            const availableGlyphs = Object.assign([], result.svg.defs[0].font[0].glyph);

            // this array will hold the actually used glyphs
            const resultingGlyphs = [];
            result.svg.defs[0].font[0].glyph = resultingGlyphs;

            // for each actually used icon class, find the glyph inside availableGlyphs and copy it
            for (const usedIcon of usedIcons) {
                const glyph = availableGlyphs.find(g => g["$"]["glyph-name"] === usedIcon);

                if (glyph) {
                    resultingGlyphs.push(glyph);
                }
            }

            // if no glyphs are used, do not write any font files but an empty CSS
            if (resultingGlyphs.length == 0) {
                tempFileCallback.call(this, path.basename(resource), "", true);
            } else {
                // write new SVG
                const builder = new xml2js.Builder();
                const newSvg = builder.buildObject(result);

                tempFileCallback.call(this, path.basename(svgPath), newSvg, false);

                // adjust the style css to refer to the new font files
                const ttfPath = FontAwesomeMinifyPlugin.extractFilePath("ttf", sourceCode);
                const eotPath = FontAwesomeMinifyPlugin.extractFilePath("eot", sourceCode);
                const woffPath = FontAwesomeMinifyPlugin.extractFilePath("woff", sourceCode);
                const woff2Path = FontAwesomeMinifyPlugin.extractFilePath("woff2", sourceCode);

                let newCss = sourceCode;
                newCss = newCss.split(svgPath).join(`./${path.basename(svgPath)}`);
                newCss = newCss.split(ttfPath).join(`./${path.basename(ttfPath)}`);
                newCss = newCss.split(eotPath).join(`./${path.basename(eotPath)}`);
                newCss = newCss.split(woffPath).join(`./${path.basename(woffPath)}`);
                newCss = newCss.split(woff2Path).join(`./${path.basename(woff2Path)}`);

                // write new CSS
                tempFileCallback.call(this, path.basename(resource), newCss, true, (tempCssFilepath) => {
                    // write ttf, etc.
                    const cssDirName = path.dirname(tempCssFilepath);

                    const ttf = svg2ttf(newSvg);
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(ttfPath))), new Buffer(ttf.buffer));

                    const woff = ttf2woff(new Uint8Array(ttf.buffer), {});
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(woffPath))), new Buffer(woff.buffer));

                    const eot = ttf2eot(new Uint8Array(ttf.buffer));
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(eotPath))), new Buffer(eot.buffer));

                    const woff2 = ttf2woff2(new Uint8Array(ttf.buffer));
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(woff2Path))), new Buffer(woff2.buffer));
                });
            }
        });
    }

    apply(compiler) {
        // always delete the tmpDir first
        const tmpDir = path.join(os.tmpdir(), "/", "fontAwesomeMinify");
        utils.deleteFolderRecursive(tmpDir);

        // create the folder
        fs.mkdirSync(tmpDir);

        let usedIconClasses = null;

        compiler.plugin("normal-module-factory", nmf => {
            nmf.plugin("after-resolve", (data, cb) => {
                if (!data) {
                    return cb();
                }

                let handler = null;

                if (/fontawesome\.css/.test(data.resource)) {
                    handler = this.processMainCss;
                } else if (/fa-(solid|regular|brands)\.css/.test(data.resource)) {
                    handler = this.processStyleCss;
                }

                // we do not want to process all files twice, since the changed CSS files stored in tmpDir are also matching the regular expressions
                if (handler && (!tmpDir || data.context !== tmpDir)) {
                    // console.info(data.context);
                    // TODO do we want to process for files in node_modules? CHECK

                    // initialize usedIconClasses when the first matching pattern matches
                    if (usedIconClasses === null) {
                        usedIconClasses = this.findUsedIconClasses();

                        // add additional classes from this.options
                        usedIconClasses = this.options.additionalClasses.concat(usedIconClasses);

                        if (usedIconClasses.length === 0) {
                            if (this.options.debug) {
                                console.info(`Did not find any icon classes - aborting.`);
                            }
                        }
                    }

                    if (usedIconClasses.length > 0) {
                        // the tempFileCallback can be invoked by the handler to write files to a temporary file,
                        // the last parameter (afterCreateCb) will be called after writing the temp file, if given
                        const tempFileCallback = (filename, contents, changeContext, afterCreateCb) => {
                            const filepath = path.join(tmpDir, filename);
                            fs.writeFileSync(filepath, contents);

                            // make webpack use the newly created file
                            if (changeContext) {
                                data.resource = filepath;
                                data.context = tmpDir;
                            }

                            if (afterCreateCb) {
                                afterCreateCb.call(this, filepath);
                            }
                        };

                        const sourceCode = fs.readFileSync(data.resource, "utf8");
                        // We do not rely on data.context here since the context in webpacks terminology can e.g. be "app" when
                        // "node_modules/fontawesome/fontawesome.css" is included inside "app/vendor.ts".
                        // We need the path "node_modules/fontawesome" as context in this case.
                        handler.call(this, sourceCode, usedIconClasses, data.resource, path.dirname(data.resource), tempFileCallback);
                    }
                }

                return cb(null, data);
            });
        });

        compiler.plugin("done", () => {
            // cleanup temp directory if not in debug
            if (tmpDir && !this.options.debug) {
                rimraf.sync(tmpDir);
            }
        });
    }
}

module.exports = FontAwesomeMinifyPlugin;
