import * as fs from "fs";

export function deleteFolderRecursive(path: string): void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach((file) => {
            const curPath = path + "/" + file;

            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });

        fs.rmdirSync(path);
    }
}

/**
 * Extracts the path to file with the given extension referred to in the given CSS source code.
 * @param extension the extension of the file to look for, without a dot
 * @param cssSource the CSS source code to look in
 * @return string the path to the file
 */
export function extractFilePath(extension: string, cssSource: string): string {
    const end = cssSource.indexOf(`.${extension}`);

    let begin = end;

    do {
        begin--;
    } while (begin > 0 && cssSource.charAt(begin) !== "'" && cssSource.charAt(begin) !== "\"");

    return cssSource.substring(begin + 1, end + 1 + extension.length);
}
