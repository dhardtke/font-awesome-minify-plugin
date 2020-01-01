export interface Options {
    /**
     * The Font Awesome class prefix, e.g. "fa".
     */
    prefix?: string;

    /**
     * A list of classes without their prefix to be included in the resulting CSS and font files.
     * @example ["help", "fa-info"]
     */
    include?: string[];

    /**
     * A list of classes without their prefix to be excluded in the resulting CSS and font files.
     * @example ["fw"]
     */
    exclude?: string[];

    /**
     * A glob pattern which results in a list of filenames where Font Awesome classes are located.
     */
    globPattern?: string;

    /**
     * The directory relative to the cwd which the HTML globPattern should be applied to.
     */
    srcDir?: string;

    /**
     * Whether debug statements should be printed to the console.
     */
    debug?: boolean;
}
