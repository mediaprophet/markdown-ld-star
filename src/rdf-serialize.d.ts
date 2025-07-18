declare module 'rdf-serialize' {
  import { Stream } from 'stream';
  import { Quad } from 'rdf-js';
  export function serialize(stream: Stream, opts: { contentType: string }): Stream;
}
