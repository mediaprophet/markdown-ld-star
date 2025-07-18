[ex]: http://example.org/

[Person]{typeof=ex:Person; name="John Doe"; age=30}

<<[Person] ex:knows [Friend]>> [SocialGraph]

## SHACL Constraints

```sparql
SELECT ?subject ?predicate ?object WHERE { ?subject ex:name ?object }