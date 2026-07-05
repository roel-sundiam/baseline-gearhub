require('dotenv').config({ path: require('path').join(__dirname, '../.env.production.local') });
const { execSync } = require('child_process');
const path = require('path');

const date = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
const outDir = path.join(__dirname, `../backup_prod_${date}`);

console.log(`Backing up production database to:\n  ${outDir}\n`);

execSync(`mongodump --uri="${process.env.MONGODB_URI}" --out="${outDir}"`, { stdio: 'inherit' });

console.log(`\nBackup complete: ${outDir}`);
