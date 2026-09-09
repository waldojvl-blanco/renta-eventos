const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json({ limit: '12mb' })); // permite miniaturas base64 de las notas
app.use(express.static(path.join(__dirname, 'public')));

// Envuelve las rutas async para que un error no tumbe el servidor.
const ruta = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    console.error('Error en', req.method, req.path, '->', err.message);
    res.status(500).json({ error: 'error interno' });
  });
};

// --- API ---
app.get(
  '/api/eventos',
  ruta(async (req, res) => {
    res.json(await db.listar());
  })
);

app.post(
  '/api/eventos',
  ruta(async (req, res) => {
    const ev = req.body || {};
    ev.id = ev.id || 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
    ev.createdAt = ev.createdAt || Date.now();
    res.json(await db.crear(ev));
  })
);

app.put(
  '/api/eventos/:id',
  ruta(async (req, res) => {
    const actualizado = await db.actualizar(req.params.id, req.body || {});
    if (!actualizado) return res.status(404).json({ error: 'no existe' });
    res.json(actualizado);
  })
);

app.delete(
  '/api/eventos/:id',
  ruta(async (req, res) => {
    const borrados = await db.borrar(req.params.id);
    res.json({ ok: true, borrados });
  })
);

// --- Importar nota desde AppSheet (botón -> Bot -> webhook) ---
// Recibe los datos de una nota (ya capturada en AppSheet, sin necesidad de
// pasar por el OCR) y arma la ficha del evento igual que si viniera de la
// captura manual. Protegido con una clave secreta (IMPORT_SECRET) que solo
// conoce el Bot. Es "upsert" por appsheet_id: si ya se había mandado esa
// misma nota, se actualiza la ficha en vez de crear una duplicada.
app.post(
  '/api/import-nota',
  ruta(async (req, res) => {
    const claveEsperada = process.env.IMPORT_SECRET;
    if (!claveEsperada) {
      return res.status(500).json({ error: 'IMPORT_SECRET no está configurado en el servidor' });
    }
    if (req.get('X-Import-Key') !== claveEsperada) {
      return res.status(401).json({ error: 'Clave de importación inválida' });
    }

    const appsheet_id = req.body && req.body.appsheet_id;
    if (!appsheet_id) return res.status(400).json({ error: 'Falta appsheet_id' });

    const todos = await db.listar();
    const existente = todos.find((e) => e.appsheet_id === appsheet_id);

    const datos = { ...req.body };

    let evento;
    let creado = false;
    if (existente) {
      evento = await db.actualizar(existente.id, datos);
    } else {
      creado = true;
      datos.id = 'e' + Date.now() + Math.random().toString(36).slice(2, 6);
      datos.createdAt = Date.now();
      evento = await db.crear(datos);
    }

    const base = `${req.protocol}://${req.get('host')}`;
    res.status(creado ? 201 : 200).json({ ok: true, id: evento.id, url: `${base}/#${evento.id}` });
  })
);

// Render consulta esta ruta para saber si el servicio está vivo.
app.get('/health', (req, res) => res.json({ ok: true }));

db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log('');
      console.log('  Renta de muebles · Dashboard de eventos');
      console.log('  Corriendo en  ->  http://localhost:' + PORT);
      console.log('  Datos en      ->  ' + db.descripcionOrigen);
      console.log('  (Ctrl+C para detener)');
      console.log('');
    });
  })
  .catch((err) => {
    console.error('No se pudo iniciar el almacenamiento:', err.message);
    process.exit(1);
  });
