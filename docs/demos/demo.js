import { parseMarkdownLD } from 'markdownld';
import fs from 'fs';

const content = fs.readFileSync('./demos/sample.md', 'utf-8');
const result = parseMarkdownLD(content);
console.log('Turtle:', result.turtle);
console.log('Constraints:', result.constraints);