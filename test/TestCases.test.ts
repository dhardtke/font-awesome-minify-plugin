import * as fs from "fs";
import {FontAwesomeMinifyPlugin} from "index";
import {Options} from "options";
import * as path from "path";
import webpack from "webpack";

function compareDirectory(actual: string, expected: string): void {
    const files = fs.readdirSync(expected);

    for (const file of files) {
        const absoluteFilePath = path.resolve(expected, file);

        const stats = fs.lstatSync(absoluteFilePath);

        if (stats.isDirectory()) {
            compareDirectory(
                path.resolve(actual, file),
                path.resolve(expected, file)
            );
        } else if (stats.isFile()) {
            const content = fs.readFileSync(path.resolve(expected, file), "utf8");
            const actualContent = fs.readFileSync(path.resolve(actual, file), "utf8");

            expect(actualContent).toEqual(content);
        }
    }
}

function compareWarning(actual: string, expectedFile: string): void {
    if (!fs.existsSync(expectedFile)) {
        return;
    }

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const expected = require(expectedFile);

    expect(actual.trim()).toBe(expected.trim());
}

describe("TestCases", () => {
    const casesDirectory = path.resolve(__dirname, "cases");
    const outputDirectory = path.resolve(__dirname, "chunks");

    for (const directory of fs.readdirSync(casesDirectory)) {
        if (!/^([._])/.test(directory)) {
            // eslint-disable-next-line no-loop-func
            it(`${directory} should compile to the expected result`, (done) => {
                const directoryForCase = path.resolve(casesDirectory, directory);
                const outputDirectoryForCase = path.resolve(outputDirectory, directory);
                // TODO code-klau attribuieren
                let options: Options = {};
                const optionsPath = path.resolve(directoryForCase, "options.ts");
                if (fs.existsSync(optionsPath)) {
                    options = require(optionsPath);
                }

                const webpackConfig: webpack.Configuration = {
                    entry: path.resolve(directoryForCase, "index.js"),
                    context: directoryForCase,
                    mode: "none",
                    module: {
                        rules: [{
                            test: /\.css$/i,
                            loader: "file-loader",
                            options: {
                                name: "[name].[ext]"
                            }
                        }]
                    },
                    output: {
                        path: outputDirectoryForCase
                    },
                    plugins: [
                        new FontAwesomeMinifyPlugin(options)
                    ]
                };

                webpack(webpackConfig, (err, stats) => {
                    if (err) {
                        done(err);
                        return;
                    }

                    done();

                    // eslint-disable-next-line no-console
                    console.log(
                        stats.toString({
                            chunks: true,
                            chunkModules: true,
                            context: path.resolve(__dirname, ".."),
                            modules: false
                        })
                    );

                    if (stats.hasErrors()) {
                        done(
                            new Error(
                                stats.toString({
                                    context: path.resolve(__dirname, ".."),
                                    errorDetails: true
                                })
                            )
                        );

                        return;
                    }

                    const expectedDirectory = path.resolve(directoryForCase, "expected");
                    const expectedDirectoryByVersion = path.join(
                        expectedDirectory,
                        `webpack-${webpack.version[0]}`
                    );

                    if (fs.existsSync(expectedDirectoryByVersion)) {
                        compareDirectory(
                            outputDirectoryForCase,
                            expectedDirectoryByVersion
                        );
                    } else {
                        compareDirectory(outputDirectoryForCase, expectedDirectory);
                    }

                    const expectedWarning = path.resolve(directoryForCase, "warnings.js");
                    const actualWarning = stats.toString({
                        all: false,
                        warnings: true
                    });
                    compareWarning(actualWarning, expectedWarning);

                    done();
                });
            }, 10000);
        }
    }
});
