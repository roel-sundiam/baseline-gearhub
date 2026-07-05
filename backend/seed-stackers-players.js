require('dotenv').config({ path: require('path').join(__dirname, '../.env.production.local') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Club = require('./models/Club');
const User = require('./models/User');

const PASSWORD = 'BaselineGearhub';

const NAMES = [
  // Group 1
  'Denz Milianxi Bonilla',
  'Richard Matthew Baron',
  'Jana Bagatsolon',
  'Pearl-Jan Gomez',
  'Ariel Malig',
  'Marcon Marquez',
  'Efren Go',
  'Adrian Joseph Jr Gajasan',
  'Julius Villaflores',
  'Raymond Adviento',
  'Libner Kiezel Vidal',
  'Christine Maria Ann Keller',
  'Dominic Boiser',
  'Hannah Czarina Tria',
  'John Bosco Quilit',
  'Rizza Mae Molo',
  'Jhal Mark Le Villareal',
  'Alvin Dennis Uriarte',
  'Jonathan Borromeo',
  // Group 2
  'Anna Nikole Dinglasan',
  'George Harrison Kline',
  'Neil Dela Cruz',
  'Lady Mariane Samson',
  'Jonathan Parlocha',
  'Veronica Tuason Tuason',
  'Lynn-Ai Kate Francisco',
  'John Niel Lao-ang',
  'Maria Teresa Evangelista',
  'Mary Ann Parlocha',
  'John Paul Sunga',
  'Marvin Quiambao',
  'Ed Lorenzo',
  'Christian Soliman',
  'Lorenz Keith Castro',
  'Marlo Magtoto',
  'Marvin Magriaga',
  'Angelo Gonzales',
  'Analyn Keller',
  // Group 3
  'Mae Anne Ortega',
  'Marivic Co',
  'Ruby Rose Lopez',
  'Jerico Mendoza',
  'Justine Culla',
  'Cyrille Dennise Reyes',
  'Caroline Bravo',
  'Carlo Gonzales',
  'Persam Cawasa',
  'Marizol Dela Cruz',
  'Jonel Paulino',
  'Paul Buban',
  'Marissa Flores',
  'John Joseph Paderes',
  'Cerjie Adrian Baldonado',
  'Paul Pagsuguiron',
  'Eli Poso',
  'Nikka Alleana Mendoza',
  'Jeremy Mallar',
  // Group 4
  'Jan Kelly Siapco',
  'Rolyn Ocampo',
  'Von Gerick Ocampo',
  'Mario Sr. Datoy',
  'Karen Dalisay',
  'Lyndon Javier',
  'Wella Siapco',
  'Ianna Castro',
  'Adamson Jr Chan',
  'Sarah Alarcon',
  'Ian Jonathan Sevilla',
  'Niño Aloysius Colegado',
  'Carrelle Colegado',
  'Jennifer Fernandez',
  'Christine Joy Mateo',
  'Jun Bautista',
  'Aldwin Mercene',
  'Marlon Magtoto',
  'Magine Mendoza',
  // Group 5
  'Kate Co',
  'Ck Bagatsolon',
  'Ryan Raymon Camacho',
  'Leonides Rommel Chan',
  'May France Dizon',
  'Mia Bagatsolon',
  'Carlos Bagatsolon',
  'Lito Lagura',
  'Sandy Marie Flores',
  'Cedric Lacanienta',
  'Mary France Dizon',
  'Carmela Jamille Tañedo',
  'Kiroe Budoso',
  'Jeffrey Mercado',
  'Reynante III Talactac',
  'Kerby Viaña',
  'Jay Casidsid',
  'Leandro Credo',
  'John Ricric Balderas',
  // Group 6
  'Rogelio Jr. Sarmiento',
  'Renz Robert Gonzalbo',
  'Ma. Theresa Sarmiento',
  'Harold Pamilar',
  'Teejay Gajasan',
  'Edson Evangelista',
  'Normandy Flores',
  'Roy Jr. Balleza',
  'Thomas Edison Tordesillas',
  'Allan Jay Fernandez',
  'CT Tordesillas',
  'Sharon Pamilar',
  'Arnold Pamilar',
  'Charles Nathan Dinglasan',
  'Allan Samson',
  'Khristian Pangilinan',
  'Cassandra Perez',
  'Jonathan Pineda',
  'Rafael Rivera',
  // Group 7
  'Gizelle Anne Bagatsolon',
  'Chona Magpantay',
  'Carlo Bagatsolon',
  'Irma Castro',
  'Fr. Cholo Panes',
  'Ana Mae Tividad',
  'Eden Yaptengco',
  'GN Bacani',
  'Jann Carl Valeroso',
  'Hannah Ludched Kline',
  'Aldrin Angelo Bagatsolon',
  'Joanna Mariz Javier',
  'Queen Divine Tovera',
  'Maria Elisa Borromeo',
  'Salvador Borromeo',
  'Kim Philip Ecleo',
  'Sharmaine Apple Fernandez',
  'Aldrin Fernandez',
  // Group 8
  'Gian Paolo Osano',
  'Jan Eric Mendoza',
  'Xabier Alee Mendoza',
  // Group 9
  'John Michael Arciag',
  'Louis Montaño',
  'Lyka Nicart',
  'Maria Angelica Sunga',
  'Ronald Francis Sanqui',
  'Dann Marie Ramones',
  'John Albert Balderas',
  'Genesis Ysibido',
  'Romulo Festin Jr',
  'Mark Stephen Felipe',
  'Rondrei Khien Rosales',
  'Marilyn Bagatsolon',
  'Leo Kristoffer Buela',
  'Erika Mendoza',
  'Darwin King Aguila',
  'Ma. Lorraine Abbyg Penetrado',
  'Brian Jayson Agustin',
  'MB Thomas Edison Tordesillas',
  // Group 10
  'Roy Hector Casem',
  'Ryan Valera',
  'Richard Lenex Acuzar',
  'Eldric Brent Mendoza',
  'Pauline Joy Olarte',
  'Janine Casem',
  'April Kim Paulino',
  'Marc Joey Ladao',
  'Jeureka May Garcia',
  'Samantha Vistan',
  'Joy Otte',
  'Jervin Alcaide',
  'Kaizzer Bernardo',
  'Charles Dinglasan',
  'Chester Tamesis',
  'Jeanne Dominique Casao',
  'Paolo Elizalde',
  'Mikko Gapas',
  'Ruxel Doreen Arciaga',
];

// Tokens that should be dropped from username generation (honorifics/titles).
const HONORIFICS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'fr']);

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip combining diacritics (ñ→n, etc.)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Build username base from first meaningful token + last meaningful token,
// filtering out honorifics/titles (Jr, Sr, III, Fr, etc.).
function usernameBase(name) {
  const words = name
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length > 0);

  const meaningful = words.filter((tok) => {
    const norm = tok.toLowerCase().replace(/\./g, '');
    return !HONORIFICS.has(norm);
  });

  if (meaningful.length === 0) return '';
  const first = meaningful[0];
  const last = meaningful[meaningful.length - 1];
  return slugify(`${first}-${last}`);
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

    const club = await Club.findOne({ name: /stackers/i });
    if (!club) {
      console.error('❌ Could not find a club matching /stackers/i');
      process.exit(1);
    }
    console.log(`✅ Found club: ${club.name} (${club._id})`);

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const usedInRun = new Set();

    let created = 0;
    let skipped = 0;
    const renamed = [];

    for (const name of NAMES) {
      const already = await User.findOne({ name, clubId: club._id }).lean();
      if (already) {
        console.log(`  ⏭️  Skipped (exists): ${name} (${already.username})`);
        skipped++;
        continue;
      }

      const base = usernameBase(name);
      if (!base) {
        console.log(`  ⚠️  Skipped (empty username): "${name}"`);
        skipped++;
        continue;
      }

      const username = await uniqueUsername(base, usedInRun);
      if (username !== base) renamed.push({ name, base, username });

      await User.create({
        name,
        username,
        passwordHash,
        role: 'player',
        status: 'active',
        clubId: club._id,
        termsAcceptedAt: new Date(),
      });
      console.log(`  ✅ Created: ${name}  ->  ${username}`);
      created++;
    }

    console.log(`\nDone — ${created} created, ${skipped} skipped, of ${NAMES.length} total.`);
    if (renamed.length) {
      console.log(`\n⚠️  ${renamed.length} username(s) got a numeric suffix (collision avoided):`);
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
