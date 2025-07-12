const fs = require('fs');

// Defaults
let templateFile = 'subgraph.template.yaml';
let outputFile = 'subgraph.yaml';
const variables = {};

// Parse CLI args
process.argv.slice(2).forEach(arg => {
  if (arg.startsWith('--template=')) {
    templateFile = arg.split('=')[1];
  } else if (arg.startsWith('--output=')) {
    outputFile = arg.split('=')[1];
  } else if (arg.includes('=')) {
    const [key, value] = arg.split('=');
    variables[key] = value;
  }
});

// Check template file exists
if (!fs.existsSync(templateFile)) {
  console.error(`❌ Template file not found: ${templateFile}`);
  process.exit(1);
}

// Read template
let template = fs.readFileSync(templateFile, 'utf-8');

// Replace ${VAR} placeholders
for (const [key, value] of Object.entries(variables)) {
  const regex = new RegExp(`\\$\\{${key}\\}`, 'g');
  template = template.replace(regex, value);
}

// Write output file
fs.writeFileSync(outputFile, template);

console.log(`✅ ${outputFile} generated from ${templateFile}`);