// heic-convert는 공식 타입 미제공 — 사용하는 표면만 선언
declare module 'heic-convert' {
  interface HeicConvertOptions {
    buffer: Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    /** JPEG 품질 0~1 */
    quality?: number;
  }
  function convert(options: HeicConvertOptions): Promise<ArrayBuffer>;
  export default convert;
}
