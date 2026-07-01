require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Club = require('./models/Club');
const User = require('./models/User');

const PASSWORD = 'SheServes';

// Roster for SheServes Tennis Club. Display name is kept exactly as written;
// the login username is auto-generated (see usernameBase()).
const NAMES = [
  'Aina David',
  'Akela Malonzo',
  'Alyssa Faye Juco',
  'Alyssa Mika Dianelo',
  'Amanda Calderon',
  'Amylou D. Mendiola',
  'Andrea Marie Henson',
  'Angelica Ferraris',
  'Angelique Diane Collado',
  'Ann Kimberlyn Vinluan',
  'Antonnette Tayag',
  'Aurealyn Soberano',
  'Avigaile Palma-musni',
  'Bea Dela Fuente',
  'Bea Dychioco',
  'Bianca Camille Piñero-fajardo',
  'Bianca Tan',
  'Camille Leyson',
  'Charissa Joy Camacam',
  'Chelsea Anne Rose Arceo',
  'Chelsea Dana Sicat',
  'Chelsea Sicat',
  'Chloe Tiotuico',
  'Christene Joyce C. De Leon',
  'Christine Cruz',
  'Christine Flores',
  'Christine Julito',
  'Cj Yu',
  'Daen Lim',
  'Danica Eloise Pangilinan',
  'Danica Mae De Guzman',
  'Danica Patt Guevarra',
  'Daniela Marie Pangilinan',
  'Daniella Punzalan',
  'Danielle C. Morales',
  'De Leon, Louisa Ally L.',
  'Ellaine Buan',
  'Elyza Manalac',
  'Elyzsa Renee Jasmine',
  'Ena Gonzales',
  'Erlinda Alejandrino',
  'Fenerose Miras',
  'Francheska Castañeda',
  'Gennica De Leon',
  'Helen Sundiam',
  'Herly Joy Ramos',
  'Ivana Datu',
  'Jana Ortiz Luis',
  'Jaymie Gamboa',
  'Jaymie Ivana Gamboa',
  'Jennifer Manio-cunanan',
  'Jerica Miranda',
  'Jessary Nhorane Trance',
  'Jessie Nepomuceno',
  'Joanne Bañez',
  'Joviane Chua',
  'Julia Carmela S. Huganas',
  'Julia Mangalino',
  'Juveine Salazar',
  'Kamille Filoteo',
  'Karla Candelaria',
  'Kate Leander',
  'Kianna Galeos',
  'Kristelle Cruz',
  'Lara Arxelie Salonga',
  'Luchie Vivas',
  'Lynjoyce David',
  'Mai Capati',
  'Marian Balderas',
  'Mariane Lim',
  'Mariella Tanglao',
  'Marivic Dizon',
  'Maude Aimee Ebio',
  'Mitzi Santos',
  'Noemi Geronimo',
  'Pam Asuncion',
  'Patricia Ann Nicole M. Reyes',
  'Patricia Jean Pineda',
  'Paula Benilde Dungo',
  'Pauleen Sengson',
  'Paulene David',
  'Rechel Crescini',
  'Reesha Vinluan',
  'Rian Pilarca',
  'Rodora Joana Almadin',
  'Rose Ann Cortez',
  'Ruth Barrera',
  'Shaine Marie Muldong',
  'Shannon Dizon',
  'Tinni Naguit',
  'Tracy Talo',
  'Trisha Aquino-dela Cruz',
  'Verin Raelle F. Barro',
  'Ysabelle Evangelista',
];

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents (ñ -> n, etc.)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // non-alphanumeric -> hyphen
    .replace(/-{2,}/g, '-')      // collapse repeats
    .replace(/^-+|-+$/g, '');    // trim hyphens
}

// Build the base username from a name, dropping single-letter middle initials
// (e.g. "Amylou D. Mendiola" -> "amylou-mendiola"). Two-letter tokens like
// "Cj" are kept.
function usernameBase(name) {
  const cleaned = name
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.replace(/[^a-zA-Z]/g, '').length > 1)
    .join(' ');
  return slugify(cleaned);
}

async function uniqueUsername(base, usedInRun) {
  let candidate = base;
  let n = 1;
  while (usedInRun.has(candidate) || (await User.findOne({ username: candidate }).lean())) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  usedInRun.add(candidate);
  return candidate;
}

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    let club = await Club.findOne({ name: /she\s*serves/i });
    if (!club) {
      const admin = await User.findOne({ username: /she-?serves/i, role: 'admin' }).lean();
      if (admin?.clubId) club = await Club.findById(admin.clubId);
    }
    if (!club) {
      console.error('❌ Could not find the SheServes club (no name match and no she-serves admin).');
      process.exit(1);
    }
    console.log(`✅ Found club: ${club.name} (${club._id})`);

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const usedInRun = new Set();

    let created = 0;
    let skipped = 0;
    const renamed = [];

    for (const name of NAMES) {
      // Idempotency: skip if this person is already in this club.
      const already = await User.findOne({ name, clubId: club._id }).lean();
      if (already) {
        console.log(`  ⏭️  Skipped (already in club): ${name} (${already.username})`);
        skipped++;
        continue;
      }

      const base = usernameBase(name);
      if (!base) { console.log(`  ⚠️  Skipped (empty username): "${name}"`); skipped++; continue; }
      const username = await uniqueUsername(base, usedInRun);
      if (username !== base) renamed.push({ name, base, username });

      await User.create({
        name,
        username,
        passwordHash,
        role: 'player',
        status: 'active',
        gender: 'Female',
        clubId: club._id,
        termsAcceptedAt: new Date(),
      });
      console.log(`  ✅ Created: ${name}  ->  ${username}`);
      created++;
    }

    console.log(`\nDone — ${created} created, ${skipped} skipped, of ${NAMES.length} total.`);
    if (renamed.length) {
      console.log(`\n⚠️  ${renamed.length} username(s) got a numeric suffix to avoid colliding with an existing account:`);
      renamed.forEach((r) => console.log(`   - "${r.name}": wanted "${r.base}", used "${r.username}"`));
    }
    console.log(`\nPassword for all created players: ${PASSWORD}`);
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

seed();
