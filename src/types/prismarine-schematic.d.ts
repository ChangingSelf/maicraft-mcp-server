declare module 'prismarine-schematic' {
  export class Schematic {
    static read(data: Buffer | Uint8Array, version: string): Promise<Schematic>
    paste(world: any, position: any): Promise<void>
  }
}

