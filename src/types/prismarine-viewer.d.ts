declare module 'prismarine-viewer/viewer' {
  export class Viewer {
    constructor(renderer: any)
    setVersion(version: string): boolean
    listen(worldView: WorldView): void
    camera: any
    scene: any
    world: any
    update(): void
  }

  export class WorldView {
    constructor(world: any, viewDistance: number, center: any)
    init(center: any): Promise<void>
    updatePosition(target: any): void
  }

  export class MapControls {
    constructor(camera: any, domElement: any)
    target: any
    update(): void
  }

  export function getBufferFromStream(stream: any): Promise<Buffer>
}

declare module 'prismarine-viewer' {
  export function headless(bot: any, options: any): Promise<void>
}

