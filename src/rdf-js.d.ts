declare module 'rdf-js' {
  export interface Term {
    termType: string;
    value: string;
  }
  export interface NamedNode extends Term {}
  export interface BlankNode extends Term {}
  export interface Literal extends Term {
    language?: string;
    datatype?: NamedNode;
  }
  export interface Quad {
    subject: Term;
    predicate: Term;
    object: Term;
    graph?: Term;
  }
  export interface DatasetCore extends Iterable<Quad> {}
}
