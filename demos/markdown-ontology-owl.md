# Markdown Ontology (OWL, Markdown-LD-Star)

[MarkdownOntology]{typeof=owl:Ontology; rdfs:label="Markdown Ontology OWL"; rdfs:comment="OWL ontology for Markdown variants and sameAs mappings to common RDF ontologies."}

[Markdown]{typeof=md:Markdown; owl:sameAs=dcterms:Text,schema:CreativeWork,og:article,foaf:Document,prov:Entity,doap:Project,gr:ProductOrService,skos:Concept}
[GitHubFlavoredMarkdown]{typeof=md:GitHubFlavoredMarkdown; rdfs:subClassOf=md:Markdown; owl:sameAs=schema:Article,og:article}
[StandardMarkdown]{typeof=md:StandardMarkdown; rdfs:subClassOf=md:Markdown; owl:sameAs=dcterms:Text}
[ObsidianMarkdown]{typeof=md:ObsidianMarkdown; rdfs:subClassOf=md:Markdown; owl:sameAs=schema:CreativeWork}

# Example Elements and Mappings
[Image]{typeof=md:Image; owl:sameAs=schema:ImageObject,og:image,foaf:Image}
[Link]{typeof=md:Link; owl:sameAs=schema:URL,og:url,foaf:page}
[Heading]{typeof=md:Heading; owl:sameAs=dcterms:title,schema:headline,og:title,skos:prefLabel}
[Paragraph]{typeof=md:Paragraph; owl:sameAs=schema:description,dcterms:description,og:description,skos:definition}
[CodeBlock]{typeof=md:CodeBlock; owl:sameAs=schema:SoftwareSourceCode}
[Table]{typeof=md:Table; owl:sameAs=schema:Table}

# Example Properties
[label]{typeof=owl:DatatypeProperty; rdfs:label="label"; rdfs:comment="Human-readable label for a Markdown element."; owl:equivalentProperty=schema:name,dc:title,og:title,skos:prefLabel}
[url]{typeof=owl:DatatypeProperty; rdfs:label="url"; rdfs:comment="URL for a link or image."; owl:equivalentProperty=schema:url,og:url,foaf:page}
[description]{typeof=owl:DatatypeProperty; rdfs:label="description"; rdfs:comment="Description or summary of a Markdown element."; owl:equivalentProperty=schema:description,dcterms:description,og:description,skos:definition}
[hasExtension]{typeof=owl:ObjectProperty}

# Example: Creative Commons, vCard, iCal, Workflow, Time, Timezone
[License]{typeof=cc:License}
[VCard]{typeof=vc:VCard}
[Vcalendar]{typeof=ical:Vcalendar}
[Workflow]{typeof=wf:Workflow}
[TemporalEntity]{typeof=time:TemporalEntity}
[TimeZone]{typeof=tzont:TimeZone}

[md]: http://example.org/markdown#
[owl]: http://www.w3.org/2002/07/owl#
[schema]: http://schema.org/
[dc]: http://purl.org/dc/elements/1.1/
[dcterms]: http://purl.org/dc/terms/
[og]: http://ogp.me/ns#
[foaf]: http://xmlns.com/foaf/0.1/
[prov]: http://www.w3.org/ns/prov#
[doap]: http://usefulinc.com/ns/doap#
[gr]: http://purl.org/goodrelations/v1#
[skos]: http://www.w3.org/2004/02/skos/core#
[cc]: http://creativecommons.org/ns#
[vc]: http://www.w3.org/2006/vcard/ns#
[ical]: http://www.w3.org/2002/12/cal/ical#
[wf]: http://www.w3.org/2005/01/wf/flow#
[time]: http://www.w3.org/2006/time#
[tzont]: http://www.w3.org/2006/timezone#
