// localtest.js
// Run this with: node localtest.js

const { parseMarkdownLD, fromRDFToMarkdownLD, markdownLDToTurtle, generateSampleOntology } = require('./dist/index.cjs');

console.log('--- Sample Ontology ---');
const sample = generateSampleOntology();
console.log(sample);

console.log('\n--- Parse Markdown-LD to Turtle ---');
const parsed = parseMarkdownLD(sample, { format: 'turtle' });
console.log(parsed.output);

console.log('\n--- Convert Turtle to Markdown-LD ---');
(async () => {
  const turtle = parsed.output;
  const md = await fromRDFToMarkdownLD(turtle, 'turtle');
  console.log(md);
})();
