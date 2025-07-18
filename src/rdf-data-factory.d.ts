declare module 'rdf-data-factory' {
  import { NamedNode, BlankNode, Literal, Quad } from 'rdf-js';
  export class DataFactory {
    static namedNode(value: string): NamedNode;
    static blankNode(value?: string): BlankNode;
    static literal(value: string, languageOrDatatype?: string): Literal;
    static quad(subject: NamedNode | BlankNode, predicate: NamedNode, object: NamedNode | BlankNode | Literal, graph?: NamedNode | BlankNode): Quad;
  }
  export const dataFactory: DataFactory;
}
