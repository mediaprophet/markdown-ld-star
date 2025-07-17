# RDF-Star-Sample

[Bob]{typeof=ex:Person; ex:age=23}

[Bob] ex:age 23 {| ex:measuredOn="2023-01-01"^^xsd:date ; ex:confidence=0.8 |}

<<[Alice] ex:name "Alice">> ex:statedBy [Bob]

<< <<[Alice] ex:name "Alice">> ex:reportedBy [Charlie] >>

<!-- This file uses Markdown-LD syntax. Parse with markdownld library: https://github.com/mediaprophet/markdownld -->

[ex]: http://example.org/

... (existing)