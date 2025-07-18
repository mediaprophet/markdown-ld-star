# Copilot Instructions Status

**Date:** July 18, 2025

## Current Status
- Working on Markdown-LD-Star converter and test suite.
- Recent focus: RDF-star support, quoted triple/annotation mapping, RDF/XML serialization, and Turtle output.
- RDF/XML output fails: rdf-serialize does not support RDF/XML; spec-compliant reification mapping needed.
- Quoted triple and annotation tests fail: Turtle output does not contain RDF-star syntax (`<< ... >>`) or annotation properties.
- Many MarkdownLD-to-Turtle and RDF-to-MarkdownLD tests fail due to missing expected triples, prefixes, or annotation values.
- Next steps: Patch converter logic to map quoted triples/annotations to RDF reification for non-RDF-star formats, and use RDF-star syntax for Turtle. Apply fixes recursively until all are resolved.

## Next Actions
1. Patch converter logic for RDF-star mapping (spec-compliant).
2. Recursively fix all related test failures.
3. After all fixes are applied, address Turtle output logic.

## Error Handling Improvements
- Refactor all parsing, conversion, and serialization logic to provide comprehensive, context-rich error messages.
  - Include details about the input, location, and possible causes.
  - Ensure all thrown errors and rejected promises use descriptive messages.
  - Add test cases to verify error handling and messaging.

---

*This file is auto-generated for Copilot status tracking.*
