const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '../src/app/version.ts');
const content = fs.readFileSync(versionFile, 'utf8');

const match = content.match(/APP_VERSION\s*=\s*'v(\d+)'/);
if (!match) {
  console.error('bump-version: could not parse version from version.ts');
  process.exit(1);
}

const next = parseInt(match[1], 10) + 1;
fs.writeFileSync(versionFile, `export const APP_VERSION = 'v${next}';\n`);
console.log(`bump-version: v${match[1]} → v${next}`);
