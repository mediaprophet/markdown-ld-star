declare module '@rdfjs/dataset' {
  import { DatasetCore, Quad } from 'rdf-js';
  export default function dataset(quads?: Iterable<Quad>): DatasetCore & { add(quad: Quad): any; match(s?: any, p?: any, o?: any, g?: any): Iterable<Quad> };
}
