import React, { useState } from 'react';
import './api-style.css';
// TODO: Import theme CSS files as needed

const demoFiles = [
  { label: 'Schema.org', file: 'schema-org-sample.md' },
  { label: 'RDF-Star', file: 'rdf-star-sample.md' },
  { label: 'SHACL', file: 'shacl-sample.md' }
];

export default function Playground() {
  const [activeTab, setActiveTab] = useState('mdToRdf');
  const [mdInput, setMdInput] = useState('');
  const [rdfInput, setRdfInput] = useState('');
  const [uri, setUri] = useState('');
  const [uriFormat, setUriFormat] = useState('turtle');
  const [outputFormat, setOutputFormat] = useState('turtle');
  const [inputFormat, setInputFormat] = useState('turtle');
  const [rdfOutput, setRdfOutput] = useState('');
  const [mdOutput, setMdOutput] = useState('');
  const [uriOutput, setUriOutput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Tab switching
  const openTab = (tab: string) => {
    setActiveTab(tab);
    setError('');
  };

  // Demo file loader
  const loadDemo = async (file: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/demos/${file}`);
      if (!response.ok) throw new Error('Demo file not found');
      const content = await response.text();
      setMdInput(content);
      setActiveTab('mdToRdf');
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Markdown-LD* to RDF
  const parseMd = async () => {
    setLoading(true);
    setError('');
    try {
      // @ts-ignore
      const MarkdownLDStar = window.MarkdownLDStar;
      if (!MarkdownLDStar) throw new Error('MarkdownLDStar not loaded');
      const result = MarkdownLDStar.parseMarkdownLD(mdInput, { format: outputFormat });
      setRdfOutput(typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2));
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // RDF to Markdown-LD*
  const convertRdf = async () => {
    setLoading(true);
    setError('');
    try {
      // @ts-ignore
      const MarkdownLDStar = window.MarkdownLDStar;
      if (!MarkdownLDStar) throw new Error('MarkdownLDStar not loaded');
      const result = await MarkdownLDStar.fromRDFToMarkdownLD(rdfInput, inputFormat);
      setMdOutput(result);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Fetch URI to Markdown-LD*
  const fetchUri = async () => {
    setLoading(true);
    setError('');
    try {
      const corsProxy = 'https://corsproxy.io/?';
      const response = await fetch(corsProxy + encodeURIComponent(uri));
      if (!response.ok) throw new Error('Fetch failed');
      const content = await response.text();
      // @ts-ignore
      const MarkdownLDStar = window.MarkdownLDStar;
      if (!MarkdownLDStar) throw new Error('MarkdownLDStar not loaded');
      const result = await MarkdownLDStar.fromRDFToMarkdownLD(content, uriFormat);
      setUriOutput(result);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="playground-demo">
      <h1>Markdown-LD* Playground</h1>
      <p>Explore Markdown-LD* in a cyberpunk matrix of linked data. Parse, convert, and fetch in the infosphere 'web of data'.</p>
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
      <div className="demo-container" style={{display:'flex'}}>
        <div className="demo-sidebar" style={{marginRight:'2em'}}>
          <h3>Demo Files</h3>
          {demoFiles.map(demo => (
            <button key={demo.file} onClick={() => loadDemo(demo.file)}>{demo.label}</button>
          ))}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div className="tab">
            <button className={activeTab==='mdToRdf' ? 'tablinks active' : 'tablinks'} onClick={()=>openTab('mdToRdf')}>Markdown-LD* to RDF</button>
            <button className={activeTab==='rdfToMd' ? 'tablinks active' : 'tablinks'} onClick={()=>openTab('rdfToMd')}>RDF to Markdown-LD*</button>
            <button className={activeTab==='fetchUri' ? 'tablinks active' : 'tablinks'} onClick={()=>openTab('fetchUri')}>Fetch URI to Markdown-LD*</button>
          </div>
          {activeTab==='mdToRdf' && (
            <div id="mdToRdf" className="tabcontent">
              <h2>Markdown-LD* to RDF</h2>
              <textarea value={mdInput} onChange={e=>setMdInput(e.target.value)} className="code-editor" placeholder="Enter Markdown-LD* here..." rows={10} style={{width:'100%'}} />
              <div style={{marginTop:'0.5em'}}>
                <select value={outputFormat} onChange={e=>setOutputFormat(e.target.value)}>
                  <option value="turtle">Turtle</option>
                  <option value="jsonld">JSON-LD</option>
                  <option value="rdfjson">RDF/JSON</option>
                  <option value="jsonldstar">JSON-LD*</option>
                </select>
                <button onClick={parseMd}>Parse</button>
              </div>
              <pre>{rdfOutput}</pre>
            </div>
          )}
          {activeTab==='rdfToMd' && (
            <div id="rdfToMd" className="tabcontent">
              <h2>RDF to Markdown-LD*</h2>
              <textarea value={rdfInput} onChange={e=>setRdfInput(e.target.value)} className="code-editor" placeholder="Enter RDF here (Turtle, JSON-LD, etc.)..." rows={10} style={{width:'100%'}} />
              <div style={{marginTop:'0.5em'}}>
                <select value={inputFormat} onChange={e=>setInputFormat(e.target.value)}>
                  <option value="turtle">Turtle</option>
                  <option value="jsonld">JSON-LD</option>
                  <option value="rdfjson">RDF/JSON</option>
                  <option value="jsonldstar">JSON-LD*</option>
                  <option value="n3">N3</option>
                  <option value="trig">TriG</option>
                </select>
                <button onClick={convertRdf}>Convert</button>
              </div>
              <pre>{mdOutput}</pre>
            </div>
          )}
          {activeTab==='fetchUri' && (
            <div id="fetchUri" className="tabcontent">
              <h2>Fetch URI to Markdown-LD*</h2>
              <input type="text" value={uri} onChange={e=>setUri(e.target.value)} placeholder="Enter RDF URI (e.g., https://example.org/data.ttl)" style={{width:'60%'}} />
              <select value={uriFormat} onChange={e=>setUriFormat(e.target.value)}>
                <option value="turtle">Turtle</option>
                <option value="jsonld">JSON-LD</option>
                <option value="rdfjson">RDF/JSON</option>
                <option value="jsonldstar">JSON-LD*</option>
              </select>
              <button onClick={fetchUri}>Fetch</button>
              <pre>{uriOutput}</pre>
            </div>
          )}
          {error && <div id="errorDisplay">Error: {error}</div>}
          {loading && <div id="loadingSpinner">Loading...</div>}
        </div>
      </div>
    </div>
  );
}
