import { parseMarkdownLD } from 'markdownld';
import fs from 'fs';

const filePath = './demos/sample.md';
try {
	const content = fs.readFileSync(filePath, 'utf-8');
	const result = parseMarkdownLD(content);
	console.log('--- Markdown-LD Demo ---');
	console.log('File:', filePath);
	console.log('Turtle Output:\n', result.turtle);
	if (result.constraints) {
		console.log('Constraints:', JSON.stringify(result.constraints, null, 2));
	} else {
		console.log('No constraints found.');
	}
} catch (err) {
	console.error('Error reading or parsing file:', err.message);
	process.exit(1);
}