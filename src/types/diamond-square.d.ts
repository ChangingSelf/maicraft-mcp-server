declare module 'diamond-square' {
  interface DiamondSquareOptions {
    version: string
    seed: number
  }

  function diamondSquare(options: DiamondSquareOptions): any
  export = diamondSquare
}

