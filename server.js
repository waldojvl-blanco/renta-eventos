const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3002;

// DATA_DIR configurable para poder montar un disco persistente en Render.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'eventos.json');

app.use(express.json({ limit: '12mb' })); // permite miniaturas base64 de las notas
app.use(express.static(path.join(__dirname, 'public')));

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');
}
function readAll() {
  ensureStore();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeAll(list) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

// --- API ---
app.get('/api/eventos', (req, res) => {
  res.json(readAll());
});

app.post('/api/eventos', (req, res) => {
  const list = readAll();
  const ev = req.body || {};
  ev.id = ev.id || ('e' + Date.now() + Math.random().toString(36).slice(2, 6));
  ev.createdAt = ev.createdAt || Date.now();
  list.push(ev);
  writeAll(list);
  res.json(ev);
});

app.put('/api/eventos/:id', (req, res) => {
  const list = readAll();
  const i = list.findIndex(e => e.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'no existe' });
  list[i] = { ...list[i], ...req.body, id: req.params.id };
  writeAll(list);
  res.json(list[i]);
});

app.delete('/api/eventos/:id', (req, res) => {
  let list = readAll();
  const before = list.length;
  list = list.filter(e => e.id !== req.params.id);
  writeAll(list);
  res.json({ ok: true, borrados: before - list.length });
});

app.listen(PORT, () => {
  console.log('');
  console.log('  Renta de muebles · Dashboard de eventos');
  console.log('  Corriendo en  ->  http://localhost:' + PORT);
  console.log('  Datos en      ->  ' + DATA_FILE);
  console.log('  (Ctrl+C para detener)');
  console.log('');
});
