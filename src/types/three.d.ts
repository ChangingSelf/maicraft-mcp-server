declare module 'three' {
  export class WebGLRenderer {
    constructor(parameters?: { canvas?: any })
    render(scene: any, camera: any): void
  }

  export const REVISION: string
  export const MOUSE: any
  export const CullFaceNone: any
  export const FrontSide: any
  export const BackSide: any
  export const DoubleSide: any
  export const NoBlending: any
  export const NormalBlending: any
  export const AdditiveBlending: any
  export const SubtractiveBlending: any
  export const MultiplyBlending: any
  export const CustomBlending: any
  export const AddEquation: any
  export const SubtractEquation: any
  export const ReverseSubtractEquation: any
  export const MinEquation: any
  export const MaxEquation: any
  export const ZeroFactor: any
  export const OneFactor: any
  export const SrcColorFactor: any
  export const OneMinusSrcColorFactor: any
  export const SrcAlphaFactor: any
  export const OneMinusSrcAlphaFactor: any
  export const DstAlphaFactor: any
  export const OneMinusDstAlphaFactor: any
  export const DstColorFactor: any
  export const OneMinusDstColorFactor: any
  export const SrcAlphaSaturateFactor: any
}
