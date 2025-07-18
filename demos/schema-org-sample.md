[schema]: https://schema.org/
[rdfs]: http://www.w3.org/2000/01/rdf-schema#

[Person]{typeof=rdfs:Class; rdfs:label="Person"; rdfs:comment="A person (alive, dead, undead, or fictional)."}

[JaneDoe]{typeof=schema:Person; schema:name="Jane Doe"; schema:jobTitle="Professor"; schema:telephone="(425) 123-4567"}

## SHACL Constraints

```sparql
SELECT ?this ?value WHERE { ?this schema:name ?value . FILTER(!isLiteral(?value)) }