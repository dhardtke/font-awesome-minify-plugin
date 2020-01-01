declare module "ttf2woff" {
    export function ttf2woff(src: Array<bigint> | Uint8Array, options?: { metadata: boolean }): Buffer;
}
