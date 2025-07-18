import {
  parseMarkdownLD,
  markdownLDToTurtle,
  generateSampleOntology,
  InputFormat
} from './index.js';

// Browser-compatible fromRDFToMarkdownLD using N3.js for Turtle/N3/Trig
import N3 from 'n3';
async function fromRDFToMarkdownLD(input: string, inputFormat: InputFormat): Promise<string> {
  try {
    if (inputFormat === 'turtle' || inputFormat === 'n3' || inputFormat === 'trig') {
      const parser = new N3.Parser({ format: inputFormat === 'trig' ? 'TriG' : 'Turtle' });
      const store = new N3.Store();
      const quads = parser.parse(input);
      store.addQuads(quads);
      // Basic Markdown-LD conversion: list subjects and predicates
      let md = '';
      const subjects = store.getSubjects(null, null, null);
      for (const subj of subjects) {
        const quads = store.getQuads(subj, null, null, null);
        md += `[${subj.value}]{`;
        for (const quad of quads) {
          md += `${quad.predicate.value}="${quad.object.value}"; `;
        }

    md = md.trimEnd() + '}\n';
      }
      return md;
    } else if (inputFormat === 'jsonld') {
      return 'JSON-LD serialization not available in browser build.';
    }
    return 'Unsupported input format in browser build.';
  } catch (e) {
    return `Error: ${e}`;
  }
}
// Browser-specific alternative for validateSHACL
async function validateSHACL(content: string, ontologyTtl: string): Promise<any[]> {
  return [{ error: 'SHACL validation not available in browser build.' }];
}

declare global {
  interface Window {
    MarkdownLDStar: any;
  }
}

// UMD global for browser
if (typeof window !== 'undefined') {
  window.MarkdownLDStar = {
    parseMarkdownLD,
    fromRDFToMarkdownLD,
    markdownLDToTurtle,
    validateSHACL,
    generateSampleOntology
  };
}
