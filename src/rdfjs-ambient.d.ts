declare module '@rdfjs/dataset' {
  import { DatasetCore } from 'rdf-js';
  export function dataset(): DatasetCore;
}

declare module '@rdfjs/data-model' {
  export * from 'rdf-js';
}
