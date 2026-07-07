/** Thrown by parseTiled/parseLDtk when a map uses an unsupported format or feature. */
export class TilemapParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TilemapParseError';
  }
}
