# Renta de muebles · Dashboard de eventos

Subes la foto o el PDF de una nota **impresa**, la app la lee con **OCR gratis**
(Tesseract, corre en el navegador — no gasta tokens ni servidor) y arma la ficha
del evento: cliente, productos a entregar, fecha/hora, lugar, observaciones y montaje.

Los eventos se guardan en `data/eventos.json` (en el servidor).

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

## Subirla a Render (para verla en el cel/iPad)

1. Sube esta carpeta a un repo de GitHub.
2. En Render: **New → Web Service**, conecta el repo.
   - Build command: `npm install`
   - Start command: `npm start`
   - Render asigna el puerto solo (la app ya lee `process.env.PORT`).
3. Listo, te da una URL https que abres desde el cel.

### Importante sobre los datos en Render (plan gratis)
En el plan gratis el disco es **temporal**: si Render reinicia o vuelves a
desplegar, `data/eventos.json` se puede borrar. Dos opciones:

- **Para uso permanente en el cel:** agrega un *Disk* en Render (de paga, ~1 USD/mes),
  móntalo por ejemplo en `/var/data` y arranca con la variable
  `DATA_DIR=/var/data`. Así los eventos no se pierden.
- **Si no quieres pagar:** corre la app en tu Mac (ahí los datos son permanentes)
  y usa Render solo para consultas rápidas.

Si más adelante quieres, se puede cambiar el guardado a una base de datos gratis
para que persista en el cel sin disco de paga.
