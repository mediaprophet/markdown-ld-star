import React, { useEffect, useState } from 'react';

export default function DemoViewer({ file, title }: { file: string; title: string }) {
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setError('');
    setContent('');
    fetch(`/demos/${file}`)
      .then(res => {
        if (!res.ok) throw new Error('Demo file not found');
        return res.text();
      })
      .then(setContent)
      .catch(e => setError(e.message));
  }, [file]);

  return (
    <div className="demo-viewer" style={{margin:'2em 0'}}>
      <h2>{title}</h2>
      {error && <div style={{color:'#d32f2f'}}>Error: {error}</div>}
      <pre style={{background:'#f4f4f4',padding:'1em',borderRadius:'6px',overflowX:'auto'}}>{content}</pre>
    </div>
  );
}
