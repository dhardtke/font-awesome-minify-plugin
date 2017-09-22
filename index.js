const glob = require("glob");
const fs = require("fs");
const path = require("path");
const os = require("os");
const rimraf = require("rimraf");

const svg2ttf = require("svg2ttf");
const ttf2woff = require("ttf2woff");
const ttf2eot = require("ttf2eot");
const ttf2woff2 = require("ttf2woff2");

class FontAwesomeMinifyPlugin {
    constructor(options) {
        this.options = Object.assign({}, {
            cssPattern: /font-awesome\.(min\.)?css/,
            additionalClasses: [],
            blacklist: ["fw", "2x", "3x", "4x", "5x", "lg", "spin", "pull-left", "pull-right", "rotate", "rotate-90", "rotate-180", "rotate-270"], // TODO
            prefix: "fa",
            srcDir: "./",
            globPattern: "**/*",
            debug: false,
            faSvg: ""
        }, options);
    }

    // TODO SCSS support

    apply(compiler) {
        const pattern = new RegExp(`${this.options.prefix}-([\\w-]+)`, "g");

        let tmpDir;

        compiler.plugin("normal-module-factory", nmf => {
            nmf.plugin("after-resolve", (data, cb) => {
                if (!data) {
                    return cb();
                }

                if (data.resource && this.options.cssPattern.test(data.resource)) {
                    // const isMinified = data.resource.indexOf(".min.css") >= 0;

                    const rawCssSource = fs.readFileSync(data.resource, "utf8");
                    const rawSvgSource = fs.readFileSync(this.options.faSvg, "utf8");
                    let cssSource = rawCssSource.match(/([^]*fa-inverse\s*{[^]*?})/)[1];
                    let svgSource = rawSvgSource.match(/([^]*<glyph glyph-name="notequal" unicode="&#x2260;" horiz-adv-x="1792"\s*\/>)/)[1];

                    const usedIcons = [];

                    const files = glob.sync(this.options.globPattern, {
                        cwd: this.options.srcDir,
                        nosort: true,
                        nodir: true,
                        absolute: true
                    });

                    for (const file of files) {
                        const contents = fs.readFileSync(file, "utf8");

                        let match;
                        while (match = pattern.exec(contents)) {
                            const iconClass = match[1];

                            if (this.options.blacklist.indexOf(iconClass) < 0 && usedIcons.indexOf(iconClass) < 0) {
                                usedIcons.push(iconClass);
                            }
                        }
                    }

                    if (this.options.debug) {
                        console.info(`Detected icons: [${usedIcons.join(", ")}]`);
                    }

                    if (usedIcons.length > 0) {
                        for (const icon of this.options.additionalClasses.concat(usedIcons)) {
                            const iconClass = `${this.options.prefix}-${icon}`;
                            const codepointMatches = rawCssSource.match(new RegExp(`\\.${iconClass}:before.*?{\\s*content:\\s*"\\\\(\\w+)";?\\s*}`));
                            if (codepointMatches) {
                                const glyphMatches = rawSvgSource.match(new RegExp(`(<glyph.*?unicode="&#x${codepointMatches[1]};"[^]*?/>)`));

                                if (glyphMatches) {
                                    svgSource += glyphMatches[1];
                                    cssSource += `.${iconClass}:before{content:"\\${codepointMatches[1]}"}`;
                                } else if (this.options.debug) {
                                    // emit warning if debug option is true
                                    console.warn(`Couldn't find glyph for ${iconClass} (detected codepoint: ${codepointMatches[1]}`);
                                }
                            } else if (this.options.debug) {
                                console.warn(`Couldn't find codepoint for ${iconClass} inside ${data.resource}`);
                            }
                        }

                        // prepare the cssSource: adjust font file paths
                        let fontDefinition = "@font-face{font-family: 'FontAwesome';";
                        fontDefinition += "src: url('./fa.eot');";
                        fontDefinition += "src: url('./fa.eot') format('embedded-opentype'), url('./fa.woff2') format('woff2'),";
                        fontDefinition += " url('./fa.woff') format('woff'), url('./fa.ttf') format('truetype'), url('./fa.svg') format('svg');";
                        fontDefinition += "font-weight: normal;font-style: normal;}";
                        cssSource = cssSource.replace(/(@font-face[^]*?})/, fontDefinition);

                        // append ending of the svg file
                        svgSource += "</font></defs></svg>";

                        // write css and svg file
                        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "/", "fontAwesomeMinify"));
                        const cssPath = path.join(tmpDir, "fa.css");
                        fs.writeFileSync(cssPath, cssSource);
                        fs.writeFileSync(path.join(tmpDir, "fa.svg"), svgSource);

                        // create ttf, woff, eot and woff2
                        const ttf = svg2ttf(svgSource);
                        fs.writeFileSync(path.join(tmpDir, "fa.ttf"), new Buffer(ttf.buffer));
                        const woff = ttf2woff(new Uint8Array(ttf.buffer), {});
                        fs.writeFileSync(path.join(tmpDir, "fa.woff"), new Buffer(woff.buffer));
                        const eot = ttf2eot(new Uint8Array(ttf.buffer));
                        fs.writeFileSync(path.join(tmpDir, "fa.eot"), new Buffer(eot.buffer));
                        const woff2 = ttf2woff2(new Uint8Array(ttf.buffer));
                        fs.writeFileSync(path.join(tmpDir, "fa.woff2"), new Buffer(woff2.buffer));

                        // make webpack use the newly created css file
                        data.resource = cssPath;
                        data.context = tmpDir;
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
