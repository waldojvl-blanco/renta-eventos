// Sube los eventos de data/eventos.json a la base de Neon.
//
// Uso:
//   DATABASE_URL="postgresql://..." node migrar.js
//
// Es seguro correrlo varias veces: los eventos que ya existen se omiten.

const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('');
  console.error('  Falta DATABASE_URL.');
  console.error('  Uso:  DATABASE_URL="postgresql://..." node migrar.js');
  console.error('');
  process.exit(1);
}

const db = require('./db');

const DATA_FILE = path.join(process.env.DATA_DIR || path.join(__dirname, 'data'), 'eventos.json');

async function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.log('No hay archivo ' + DATA_FILE + '. Nada que migrar.');
    return;
  }

  const eventos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  if (!Array.isArray(eventos) || eventos.length === 0) {
    console.log('El archivo está vacío. Nada que migrar.');
    return;
  }

  await db.init();
  const pool = db._pool();

  let subidos = 0;
  let omitidos = 0;

  for (const ev of eventos) {
    const id = ev.id || 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
    const createdAt = ev.createdAt || Date.now();
    const completo = { ...ev, id, createdAt };

    const r = await pool.query(
      `INSERT INTO eventos (id, created_at, data)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [id, createdAt, completo]
    );

    if (r.rowCount > 0) {
      subidos++;
      console.log('  + ' + (ev.cliente || id) + (ev.fecha ? '  (' + ev.fecha + ')' : ''));
    } else {
      omitidos++;
    }
  }

  const total = await pool.query('SELECT COUNT(*)::int AS n FROM eventos');

  console.log('');
  console.log('  Subidos:  ' + subidos);
  console.log('  Omitidos: ' + omitidos + ' (ya existían)');
  console.log('  Total en la base: ' + total.rows[0].n);
  console.log('');

  await pool.end();
}

main().catch((err) => {
  console.error('Error migrando:', err.message);
  process.exit(1);
});
