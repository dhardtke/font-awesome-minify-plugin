import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {svg2ttf} from "svg2ttf";
import {ttf2eot} from "ttf2eot";
import {ttf2woff} from "ttf2woff";
import {ttf2woff2} from "ttf2woff2";
import * as webpack from "webpack";
import * as xml2js from "xml2js";
import {ClassFinder} from "./class-finder";
import {Options} from "./options";
import {deleteFolderRecursive, extractFilePath} from "./utils";

const PLUGIN_NAME = "FontAwesomeMinifyPlugin";

// TODO figure out why the plugin can't extend from webpack.Plugin
export class FontAwesomeMinifyPlugin {
    private options: Options;
    private finder: ClassFinder;

    constructor(options: Options) {
        const defaults: Options = {
            include: [],
            exclude: ["fw", "2x", "3x", "4x", "5x", "lg", "spin", "pull-left", "pull-right", "rotate", "rotate-90", "rotate-180", "rotate-270",
                "regular", "solid", "brands"],
            prefix: "fa",
            srcDir: "./",
            globPattern: "**/*",
            debug: false
        };
        this.options = {...defaults, ...options};

        this.finder = new ClassFinder(this.options.prefix, this.options.include, this.options.exclude, this.options.globPattern, this.options.srcDir);
    }

    // noinspection JSUnusedGlobalSymbols
    public apply(compiler: webpack.Compiler): void {
        // always delete the tmpDir first
        const tmpDir = path.join(os.tmpdir(), "/", `fontAwesomeMinify${crypto.randomBytes(16).toString("hex")}`);
        deleteFolderRecursive(tmpDir);
        fs.mkdirSync(tmpDir);

        let matching = false;

        compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf) => {
            nmf.hooks.afterResolve.tapAsync(PLUGIN_NAME, (data, cb) => {
                if (!data) {
                    return cb();
                }

                let handler = null;

                // TODO add types / replace callback mess
                // TODO process should be:
                // fortawesome detected -> write used codepoints into file, also write used font references
                if (/fontawesome\.css/.test(data.resource)) {
                    handler = this.processMainCss;
                } else if (/(solid|regular|brands|light)\.css/.test(data.resource)) {
                    handler = this.processStyleCss;
                }

                // we do not want to process all files twice, since the changed CSS files stored in tmpDir are also matching the regular expressions
                if (handler && data.context !== tmpDir) {
                    matching = true;
                    const usedClasses: Set<string> = this.finder.find();
                    if (usedClasses.size > 0) {
                        // the tempFileCallback can be invoked by the handler to write files to a temporary file,
                        // the last parameter (afterCreateCb) will be called after writing the temp file, if given
                        const tempFileCallback = (filename: string, contents: string, changeContext: boolean, afterCreateCb: any) => {
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
                        handler.call(this, sourceCode, usedClasses, data.resource, path.dirname(data.resource), tempFileCallback);
                    } else if (this.options.debug) {
                        console.info(`Did not find any icon classes - aborting.`);
                    }
                }

                return cb(null, data);
            });
        });

        compiler.hooks.done.tap("FontAwesomeMinifyPlugin", () => {
            if (tmpDir && !this.options.debug) {
                deleteFolderRecursive(tmpDir);
            }

            if (this.options.debug && !matching) {
                console.warn("Could not find any Font Awesome CSS file.");
            }
        });
    }

    /**
     * Processes the main css file, usually "fontawesome.css":
     * Creates and writes a new CSS file only containing the codepoints for the used icons.
     * TODO remove tempFileCallback
     */
    private processMainCss(sourceCode: string, usedIcons: Set<string>, resource: string, context: any, tempFileCallback: any): void {
        // build new CSS
        // TODO use prefix instead of `fa`-inverse
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
     */
    private processStyleCss(sourceCode: string, usedIcons: Set<string>, resource: string, context: any, tempFileCallback: any): void {
        // read normalized svg path
        const svgPath = extractFilePath("svg", sourceCode);
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

        parser.parseString(data, (err: any, result: any) => {
            // copy the glyphs from the parsed SVG and use them as source
            const availableGlyphs = Object.assign([], result.svg.defs[0].font[0].glyph);

            // this array will hold the actually used glyphs
            const resultingGlyphs: any[] = [];
            result.svg.defs[0].font[0].glyph = resultingGlyphs;

            // for each actually used icon class, find the glyph inside availableGlyphs and copy it
            for (const usedIcon of usedIcons) {
                const glyph = availableGlyphs.find((g: any) => g.$["glyph-name"] === usedIcon);

                if (glyph) {
                    resultingGlyphs.push(glyph);
                }
            }

            // if no glyphs are used, do not write any font files but an empty CSS
            if (resultingGlyphs.length === 0) {
                tempFileCallback(path.basename(resource), "", true);
            } else {
                // write new SVG
                // TODO get rid of xml2js dependency
                const builder = new xml2js.Builder();
                const newSvg = builder.buildObject(result);

                tempFileCallback.call(this, path.basename(svgPath), newSvg, false);

                // adjust the style css to refer to the new font files
                const ttfPath = extractFilePath("ttf", sourceCode);
                const eotPath = extractFilePath("eot", sourceCode);
                const woffPath = extractFilePath("woff", sourceCode);
                const woff2Path = extractFilePath("woff2", sourceCode);

                let newCss = sourceCode;
                newCss = newCss.split(svgPath).join(`./${path.basename(svgPath)}`);
                newCss = newCss.split(ttfPath).join(`./${path.basename(ttfPath)}`);
                newCss = newCss.split(eotPath).join(`./${path.basename(eotPath)}`);
                newCss = newCss.split(woffPath).join(`./${path.basename(woffPath)}`);
                newCss = newCss.split(woff2Path).join(`./${path.basename(woff2Path)}`);

                // write new CSS
                tempFileCallback(path.basename(resource), newCss, true, (tempCssFilepath: string) => {
                    // write ttf, etc.
                    const cssDirName = path.dirname(tempCssFilepath);

                    const ttf = svg2ttf(newSvg);
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(ttfPath))), new Buffer(ttf.buffer));

                    const woff = ttf2woff(new Uint8Array(ttf.buffer));
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(woffPath))), new Buffer(woff.buffer));

                    const eot = ttf2eot(new Uint8Array(ttf.buffer));
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(eotPath))), new Buffer(eot.buffer));

                    const woff2 = ttf2woff2(new Uint8Array(ttf.buffer));
                    fs.writeFileSync(path.normalize(path.join(cssDirName, path.basename(woff2Path))), woff2);
                });
            }
        });
    }
}
