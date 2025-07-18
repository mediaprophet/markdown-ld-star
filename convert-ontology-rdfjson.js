import fs from 'fs';
import N3 from 'n3';

function convertTurtleToRDFJSON(turtlePath, rdfjsonPath) {
  const turtle = fs.readFileSync(turtlePath, 'utf-8');
  const parser = new N3.Parser();
  const quads = parser.parse(turtle);
  // Convert quads to RDF/JSON structure
  const rdfjson = {};
  for (const quad of quads) {
    const subj = quad.subject.value;
    const pred = quad.predicate.value;
    const obj = quad.object;
    if (!rdfjson[subj]) rdfjson[subj] = {};
    if (!rdfjson[subj][pred]) rdfjson[subj][pred] = [];
    if (obj.termType === 'Literal') {
      rdfjson[subj][pred].push({
        type: 'literal',
        value: obj.value,
        datatype: obj.datatype.value,
        ...(obj.language ? { lang: obj.language } : {})
      });
    } else {
      rdfjson[subj][pred].push({
        type: 'uri',
        value: obj.value
      });
    }
  }
  fs.writeFileSync(rdfjsonPath, JSON.stringify(rdfjson, null, 2));
  console.log('Converted to RDF/JSON:', rdfjsonPath);
}

convertTurtleToRDFJSON('./ontologies/markdown-ontology.ttl', './ontologies/markdown-ontology.rdf.json');
