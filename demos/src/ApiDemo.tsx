import React, { useState } from 'react';
import './api-style.css';
import { fromRDFToMarkdownLD } from 'markdown-ld-star';

const corsProxy = 'https://corsproxy.io/?';

export default function ApiDemo() {
  const [uri, setUri] = useState('');
  const [field, setField] = useState('');
  const [inputFormat, setInputFormat] = useState('turtle');
  const [outputFormat, setOutputFormat] = useState('markdownld');
  const [error, setError] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOutput('');
    if (!uri) {
      setError('Please provide a URI.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(corsProxy + encodeURIComponent(uri));
      if (!response.ok) throw new Error('Fetch failed');
      const content = await response.text();
      let result = '';
      if (field) {
        const jsonld = await fromRDFToMarkdownLD(content, inputFormat);
        const data = typeof jsonld === 'string' ? JSON.parse(jsonld) : jsonld;
        let value = null;
        if (data && data['@graph']) {
          for (const node of data['@graph']) {
            if (node[field]) {
              value = node[field];
              break;
            }
          }
        }
        if (outputFormat === 'json') {
          result = JSON.stringify({ [field]: value }, null, 2);
        } else if (outputFormat === 'turtle') {
          result = `<#this> ${field} "${value}" .`;
        } else {
          result = `[<#this>]{${field}="${value}"}`;
        }
      } else {
        result = await fromRDFToMarkdownLD(content, inputFormat);
      }
      setOutput(result);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="api-demo">
      <h1>Markdown-LD* API Demo</h1>
      <p>This page demonstrates API-like usage of the playground via URL parameters.<br />
        See the <a href="../README.md">README</a> for full documentation.</p>
      <div className="info-box" style={{marginBottom:'1em',background:'#23234a',padding:'0.7em',borderRadius:'6px',color:'#e6e6ff'}}>
        <b>Markdown Syntax Ontology:</b>
        <a href="../src/markdown-ontology.ttl" target="_blank">Turtle</a> |
        <a href="../src/markdown-ontology.owl" target="_blank">OWL (sameAs mappings)</a> —
        <span title="Standard Markdown">Standard</span>,
        <span title="GitHub Flavored Markdown">GFM</span>,
        <span title="Obsidian Markdown">Obsidian</span>
        <br />
        Use this ontology to annotate or parse Markdown documents by variant and features. The OWL file includes <code>owl:sameAs</code> links to common RDF ontologies.
      </div>
      <form className="api-form" onSubmit={handleSubmit}>
        <label>RDF URI:
          <input type="text" value={uri} onChange={e => setUri(e.target.value)} style={{width:'60%'}} placeholder="Enter RDF URI (e.g., https://example.org/data.ttl)" />
        </label><br />
        <label>Field:
          <input type="text" value={field} onChange={e => setField(e.target.value)} style={{width:'30%'}} placeholder="e.g., foaf:name" />
        </label><br />
        <label>Input Format:
          <select value={inputFormat} onChange={e => setInputFormat(e.target.value)}>
            <option value="turtle">Turtle</option>
            <option value="jsonld">JSON-LD</option>
            <option value="rdfjson">RDF/JSON</option>
            <option value="jsonldstar">JSON-LD*</option>
            <option value="n3">N3</option>
            <option value="trig">TriG</option>
          </select>
        </label>
        <label style={{marginLeft:'2em'}}>Output Format:
          <select value={outputFormat} onChange={e => setOutputFormat(e.target.value)}>
            <option value="markdownld">Markdown-LD*</option>
            <option value="json">JSON</option>
            <option value="turtle">Turtle</option>
          </select>
        </label>
        <button type="submit" style={{marginLeft:'2em'}} disabled={loading}>{loading ? 'Querying...' : 'Query'}</button>
      </form>
      {error && <div id="errorDisplay">Error: {error}</div>}
      <pre className="api-output">{output}</pre>
    </div>
  );
}
