import * as fs from "fs";
import {sync} from "glob";

/**
 * Finds occurrences of Font Awesome classes like "fa-help" in a globbed list of files of a given folder.
 * Only hits the file system once and returns cached results otherwise.
 */
export class ClassFinder {
    private readonly pattern: RegExp;

    private results: Set<string> | null;

    constructor(prefix: string, private include: string[], private exclude: string[], private globPattern: string, private srcDir: string) {
        this.pattern = new RegExp(`${prefix}-([\\w-]+)`, "g");
    }

    public find(): Set<string> {
        if (this.results) {
            return this.results;
        }

        this.results = new Set();

        const files = sync(this.globPattern, {
            absolute: true,
            cwd: this.srcDir,
            nodir: true,
            nosort: true
        });

        for (const file of files) {
            const contents = fs.readFileSync(file, "utf8");

            let match = this.pattern.exec(contents);
            while (match != null) {
                const iconClass = match[1];
                if (!this.exclude.includes(iconClass)) {
                    this.results.add(iconClass);
                }
                match = this.pattern.exec(contents);
            }
        }

        // TODO
        /*
        if (this.options.debug) {
            console.info(`Detected ${usedIconClasses.size} icons: [${Array.from(usedIconClasses).join(", ")}]`);
        }
         */

        for (const clazz of this.include) {
            this.results.add(clazz);
        }

        return this.results;
    }
}
