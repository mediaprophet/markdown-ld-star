import React, { useState } from 'react';
import ApiDemo from './ApiDemo';
import Playground from './Playground';
import DemoViewer from './DemoViewer';

const demoList = [
  { key: 'api', label: 'API Demo', component: <ApiDemo /> },
  { key: 'playground', label: 'Playground', component: <Playground /> },
  { key: 'schema', label: 'Schema.org Sample', component: <DemoViewer file="schema-org-sample.md" title="Schema.org Sample" /> },
  { key: 'rdfstar', label: 'RDF-Star Sample', component: <DemoViewer file="rdf-star-sample.md" title="RDF-Star Sample" /> },
  { key: 'shacl', label: 'SHACL Sample', component: <DemoViewer file="shacl-sample.md" title="SHACL Sample" /> },
  { key: 'foaf', label: 'FOAF Sample', component: <DemoViewer file="foaf-sample.md" title="FOAF Sample" /> },
  { key: 'sample', label: 'Sample Markdown', component: <DemoViewer file="sample.md" title="Sample Markdown" /> },
];

export default function DemoMenu() {
  const [active, setActive] = useState('api');

  return (
    <div style={{display:'flex',minHeight:'100vh'}}>
      <nav style={{width:'220px',background:'#23234a',color:'#e6e6ff',padding:'2em 1em',borderRight:'2px solid #222'}}>
        <h2 style={{marginTop:0}}>Demos</h2>
        <ul style={{listStyle:'none',padding:0}}>
          {demoList.map(demo => (
            <li key={demo.key} style={{margin:'1em 0'}}>
              <button onClick={()=>setActive(demo.key)} style={{width:'100%',padding:'0.7em',borderRadius:'6px',border:'none',background:active===demo.key?'#0078d4':'#444',color:'#fff',cursor:'pointer'}}>
                {demo.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <main style={{flex:1,padding:'2em'}}>
        {demoList.find(d=>d.key===active)?.component}
      </main>
    </div>
  );
}
