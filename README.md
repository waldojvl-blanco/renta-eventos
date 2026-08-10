# Renta de muebles · Dashboard de eventos

Subes la foto o el PDF de una nota **impresa**, la app la lee con **OCR gratis**
(Tesseract, corre en el navegador — no gasta tokens ni servidor) y arma la ficha
del evento: cliente, productos a entregar, fecha/hora, lugar, observaciones y montaje.

**Dónde se guardan los eventos:**

- Si existe la variable `DATABASE_URL` → en **Postgres (Neon)**. Permanente.
- Si no existe → en `data/eventos.json`. Práctico para trabajar en tu Mac.

No hay que cambiar nada de código para pasar de uno a otro: solo la variable.

---

## Correr en tu Mac

1. Abre la terminal en esta carpeta.
2. Instala una sola vez:
   ```
   npm install
   ```
3. Arráncala:
   ```
   npm start
   ```
4. Abre en el navegador: **http://localhost:3002**

> Usa el puerto **3002** para no chocar con comisiones-app (3000) ni la otra (3001).
> Si algún día quieres otro puerto: `PORT=3005 npm start`.

Recuerda: si reemplazas archivos de `public/`, reinicia con **Ctrl+C** y `npm start`.

---

## Publicarla: Neon (base de datos) + Render (servidor)

Repo: <https://github.com/waldojvl-blanco/renta-eventos>

### Paso 1 · Crear la base en Neon

1. Entra a <https://console.neon.tech> → **New Project**.
2. Nómbralo `renta-eventos`. Región: la más cercana (US East suele servir).
3. Al terminar te muestra la **connection string**. Se ve así:
   ```
   postgresql://usuario:CONTRASEÑA@ep-algo-123.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
4. Cópiala. **Es una contraseña: no la pegues en el código ni en el repo.**

No hace falta crear tablas a mano — la app crea la tabla `eventos` sola al arrancar.

### Paso 2 · Subir los eventos que ya tienes

En la terminal, dentro de esta carpeta (pega tu connection string entre comillas):

```
DATABASE_URL="postgresql://...pega-la-tuya..." npm run migrar
```

Te dice cuántos eventos subió. Puedes correrlo varias veces sin duplicar nada.

### Paso 3 · Crear el servicio en Render

1. Entra a <https://dashboard.render.com> → **New → Web Service**.
2. Conecta el repo `waldojvl-blanco/renta-eventos`.
3. Configuración:
   - Runtime: **Node**
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: **Free**
4. En **Environment Variables** agrega:
   - Key: `DATABASE_URL`
   - Value: tu connection string de Neon
5. **Create Web Service**. Render te da una URL https para abrir desde el cel.

Ya no necesitas disco de paga: los datos viven en Neon.

### Cómo saber que quedó bien

- Abre `https://tu-app.onrender.com/health` → debe responder `{"ok":true}`.
- En los logs de Render debe decir `Datos en -> Postgres (Neon)`.
  Si dice una ruta de archivo, es que falta la variable `DATABASE_URL`.

> El plan gratis de Render duerme el servicio tras ~15 min sin uso.
> La primera carga después de dormir tarda unos 30–50 segundos. Los datos no se pierden.
