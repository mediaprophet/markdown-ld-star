import React, { useState } from 'react';
import { themes } from './themeLoader';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(themes[0].className);

  React.useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  return (
    <div style={{position:'fixed',top:18,right:18,zIndex:1000}}>
      <label style={{marginRight:'1em'}}>Theme:</label>
      <select value={theme} onChange={e=>setTheme(e.target.value)}>
        {themes.map(t => (
          <option key={t.className} value={t.className}>{t.name}</option>
        ))}
      </select>
    </div>
  );
}
