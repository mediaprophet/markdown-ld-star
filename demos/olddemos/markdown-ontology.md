# Markdown Ontology (Markdown-LD-Star)

[MarkdownOntology]{typeof=owl:Ontology; rdfs:label="Markdown Ontology"; rdfs:comment="An RDF ontology for Markdown format based on GitHub Flavored Markdown (GFM) specification."}

[Document]{typeof=md:Document; rdfs:label="Document"; rdfs:comment="The root element of a Markdown document containing block-level and inline elements."}
[BlockElement]{typeof=md:BlockElement; rdfs:label="Block Element"; rdfs:comment="Structural elements that form the document's layout."; rdfs:subClassOf=md:Document}
[InlineElement]{typeof=md:InlineElement; rdfs:label="Inline Element"; rdfs:comment="Formatting elements within block-level content."; rdfs:subClassOf=md:Document}
[Paragraph]{typeof=md:Paragraph; rdfs:label="Paragraph"; rdfs:comment="A block of text separated by blank lines."; rdfs:subClassOf=md:BlockElement}
[Heading]{typeof=md:Heading; rdfs:label="Heading"; rdfs:comment="Section titles marked by # symbols, levels 1-6."; rdfs:subClassOf=md:BlockElement}
[List]{typeof=md:List; rdfs:label="List"; rdfs:comment="Unordered or ordered lists."; rdfs:subClassOf=md:BlockElement}
[Blockquote]{typeof=md:Blockquote; rdfs:label="Blockquote"; rdfs:comment="Quoted content prefixed by >."; rdfs:subClassOf=md:BlockElement}
[CodeBlock]{typeof=md:CodeBlock; rdfs:label="Code Block"; rdfs:comment="Fenced or indented code blocks."; rdfs:subClassOf=md:BlockElement}
[HorizontalRule]{typeof=md:HorizontalRule; rdfs:label="Horizontal Rule"; rdfs:comment="Thematic breaks using ---, ***, or ___."; rdfs:subClassOf=md:BlockElement}
[Table]{typeof=md:Table; rdfs:label="Table"; rdfs:comment="GFM extension for tables using | separators."; rdfs:subClassOf=md:BlockElement}
[Emphasis]{typeof=md:Emphasis; rdfs:label="Emphasis"; rdfs:comment="Italic text using * or _."; rdfs:subClassOf=md:InlineElement}
[StrongEmphasis]{typeof=md:StrongEmphasis; rdfs:label="Strong Emphasis"; rdfs:comment="Bold text using ** or __."; rdfs:subClassOf=md:InlineElement}
[Link]{typeof=md:Link; rdfs:label="Link"; rdfs:comment="Hyperlinks using [text](url)."; rdfs:subClassOf=md:InlineElement}
[Image]{typeof=md:Image; rdfs:label="Image"; rdfs:comment="Images using ![alt](url)."; rdfs:subClassOf=md:InlineElement}
[CodeSpan]{typeof=md:CodeSpan; rdfs:label="Code Span"; rdfs:comment="Inline code using backticks."; rdfs:subClassOf=md:InlineElement}
[Strikethrough]{typeof=md:Strikethrough; rdfs:label="Strikethrough"; rdfs:comment="GFM extension using ~~text~~."; rdfs:subClassOf=md:InlineElement}
[TaskList]{typeof=md:TaskList; rdfs:label="Task List"; rdfs:comment="GFM extension for checklists in lists."; rdfs:subClassOf=md:InlineElement}

# Properties
[hasBlock]{typeof=owl:ObjectProperty; rdfs:label="has Block"; rdfs:comment="Relates a document or container to a block-level element."; rdfs:domain=md:Document; rdfs:range=md:BlockElement}
[hasInline]{typeof=owl:ObjectProperty; rdfs:label="has Inline"; rdfs:comment="Relates a block-level element to an inline element."; rdfs:domain=md:BlockElement; rdfs:range=md:InlineElement}
[syntaxRule]{typeof=owl:DatatypeProperty; rdfs:label="syntax Rule"; rdfs:comment="Defines the syntax rule for an element."; rdfs:range=rdfs:Literal}
[level]{typeof=owl:DatatypeProperty; rdfs:label="level"; rdfs:comment="Level of headings (1-6)."; rdfs:domain=md:Heading; rdfs:range=xsd:integer}

# Example Individuals
[exampleDoc1]{typeof=md:Document; md:hasBlock=md:exampleHeading1,md:examplePara1,md:exampleList1,md:exampleFrontmatter1}
[exampleHeading1]{typeof=md:Heading; md:level=1; rdfs:label="Example Heading"}
[examplePara1]{typeof=md:Paragraph; md:hasInline=md:exampleLink1,md:exampleWikilink1}
[exampleLink1]{typeof=md:Link; rdfs:label="GitHub"; md:references="https://github.com/"}
[exampleWikilink1]{typeof=md:Wikilink; rdfs:label="HomePage"; md:references="obsidian://HomePage"}
[exampleList1]{typeof=md:List; md:hasChild=md:exampleTask1}
[exampleTask1]{typeof=md:TaskList; rdfs:label="[x] Write ontology"}
[exampleFrontmatter1]{typeof=md:Frontmatter; rdfs:label="---\ntitle: Example\n---"}

[md]: http://example.org/markdown#
[rdf]: http://www.w3.org/1999/02/22-rdf-syntax-ns#
[rdfs]: http://www.w3.org/2000/01/rdf-schema#
[owl]: http://www.w3.org/2002/07/owl#
[schema]: http://schema.org/
[xsd]: http://www.w3.org/2001/XMLSchema#
