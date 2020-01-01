declare module "svg2ttf" {
    interface Options {
        copyright?: string;
        description?: string;
        ts?: number;
        url?: string;
        version?: string;
    }

    export function svg2ttf(svgString: string, options?: Options): Buffer;
}
