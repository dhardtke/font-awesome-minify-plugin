import {Options} from "options";
import * as path from "path";

const options: Options = {
    srcDir: path.resolve(__dirname, "tpl"),
    globPattern: "*.html",
};

export = options;
