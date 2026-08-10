// Capa de almacenamiento.
// Si existe DATABASE_URL  -> usa Postgres (Neon) para datos permanentes.
// Si no existe            -> usa data/eventos.json, igual que antes (desarrollo local).

const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const usandoPostgres = Boolean(DATABASE_URL);

// ---------------------------------------------------------------------------
// Modo Postgres (Neon)
// ---------------------------------------------------------------------------
let pool = null;

if (usandoPostgres) {
  const { Pool } = require('pg');
  pool = new Pool({
    connectionString: DATABASE_URL,
    // Neon exige SSL. rejectUnauthorized:false evita problemas de certificado en Render.
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

async function initPostgres() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos (
      id          TEXT PRIMARY KEY,
      created_at  BIGINT NOT NULL,
      data        JSONB  NOT NULL
    )
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS eventos_created_at_idx ON eventos (created_at)`
  );
}

// Los eventos se guardan completos en la columna JSONB, así no hay que
// declarar cada campo (cliente, telefono, productos, etc.) por separado.
function fila_a_evento(row) {
  return { ...row.data, id: row.id, createdAt: Number(row.created_at) };
}

const pg = {
  async listar() {
    const r = await pool.query(
      'SELECT id, created_at, data FROM eventos ORDER BY created_at ASC'
    );
    return r.rows.map(fila_a_evento);
  },

  async crear(ev) {
    await pool.query(
      'INSERT INTO eventos (id, created_at, data) VALUES ($1, $2, $3)',
      [ev.id, ev.createdAt, ev]
    );
    return ev;
  },

  async actualizar(id, cambios) {
    const r = await pool.query('SELECT id, created_at, data FROM eventos WHERE id = $1', [id]);
    if (r.rowCount === 0) return null;

    const actual = fila_a_evento(r.rows[0]);
    const nuevo = { ...actual, ...cambios, id };

    await pool.query('UPDATE eventos SET data = $2 WHERE id = $1', [id, nuevo]);
    return nuevo;
  },

  async borrar(id) {
    const r = await pool.query('DELETE FROM eventos WHERE id = $1', [id]);
    return r.rowCount;
  },
};

// ---------------------------------------------------------------------------
// Modo archivo JSON (desarrollo local, sin base de datos)
// ---------------------------------------------------------------------------
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'eventos.json');

function asegurarArchivo() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}

function leerTodo() {
  asegurarArchivo();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function escribirTodo(lista) {
  asegurarArchivo();
  fs.writeFileSync(DATA_FILE, JSON.stringify(lista, null, 2));
}

const archivo = {
  async listar() {
    return leerTodo();
  },

  async crear(ev) {
    const lista = leerTodo();
    lista.push(ev);
    escribirTodo(lista);
    return ev;
  },

  async actualizar(id, cambios) {
    const lista = leerTodo();
    const i = lista.findIndex((e) => e.id === id);
    if (i < 0) return null;
    lista[i] = { ...lista[i], ...cambios, id };
    escribirTodo(lista);
    return lista[i];
  },

  async borrar(id) {
    let lista = leerTodo();
    const antes = lista.length;
    lista = lista.filter((e) => e.id !== id);
    escribirTodo(lista);
    return antes - lista.length;
  },
};

// ---------------------------------------------------------------------------

const store = usandoPostgres ? pg : archivo;

async function init() {
  if (usandoPostgres) await initPostgres();
  else asegurarArchivo();
}

module.exports = {
  init,
  usandoPostgres,
  descripcionOrigen: usandoPostgres ? 'Postgres (Neon)' : DATA_FILE,
  listar: (...a) => store.listar(...a),
  crear: (...a) => store.crear(...a),
  actualizar: (...a) => store.actualizar(...a),
  borrar: (...a) => store.borrar(...a),
  _pool: () => pool,
};
