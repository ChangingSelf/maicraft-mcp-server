declare module 'node-canvas-webgl' {
  export function createCanvas(width: number, height: number): Canvas

  export interface Canvas {
    width: number
    height: number
    createJPEGStream(options?: { quality?: number; progressive?: boolean }): any
    createPNGStream(): any
    toDataURL(type?: string): string
    toBuffer(): Buffer
    getContext(type: string, options?: any): any
  }
}

