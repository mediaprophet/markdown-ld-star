import fs from 'fs';
import N3 from 'n3';
import jsonld from 'jsonld';

async function convertTurtleToJSONLD(turtlePath, jsonldPath) {
  const turtle = fs.readFileSync(turtlePath, 'utf-8');
  const parser = new N3.Parser();
  const quads = parser.parse(turtle);
  const writer = new N3.Writer({ format: 'N-Quads' });
  writer.addQuads(quads);
  writer.end(async (err, nquads) => {
    if (err) throw err;
    const doc = await jsonld.fromRDF(nquads, { format: 'application/n-quads' });
    const compacted = await jsonld.compact(doc, {});
    fs.writeFileSync(jsonldPath, JSON.stringify(compacted, null, 2));
    console.log('Converted to JSON-LD:', jsonldPath);
  });
}

convertTurtleToJSONLD('./ontologies/markdown-ontology.ttl', './ontologies/markdown-ontology.jsonld');
