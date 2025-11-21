const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Almacenamiento en memoria de pallets por anden
let andenes = [
  { id: 1, pallets: [], numeroCajas: 0, cantidad: 0, status: 'En espera', destino: '', ultimaFechaEscaneo: null },
  { id: 2, pallets: [], numeroCajas: 0, cantidad: 0, status: 'En espera', destino: '', ultimaFechaEscaneo: null },
  { id: 3, pallets: [], numeroCajas: 0, cantidad: 0, status: 'En espera', destino: '', ultimaFechaEscaneo: null },
  { id: 4, pallets: [], numeroCajas: 0, cantidad: 0, status: 'En espera', destino: '', ultimaFechaEscaneo: null },
  {
    id: 5,
    pallets: [
      { id: 'p1', ubicacion: 'A5', numeroParte: 'P-12345', codigoPallet: 'CP-001', timestamp: Date.now() },
      { id: 'p2', ubicacion: 'A5', numeroParte: 'P-12346', codigoPallet: 'CP-002', timestamp: Date.now() }
    ],
    numeroCajas: 8,
    cantidad: 2,
    status: 'Cargando',
    destino: 'Dallas',
    ultimaFechaEscaneo: Date.now()
  },
  {
    id: 6,
    pallets: Array.from({ length: 30 }, (_, i) => ({
      id: `p${i+1+100}`,
      ubicacion: 'A6',
      numeroParte: `P-6789${i}`,
      codigoPallet: `CP-${i+100}`,
      timestamp: Date.now()
    })),
    numeroCajas: 15,
    cantidad: 30,
    status: 'Completado',
    destino: 'Toronto',
    ultimaFechaEscaneo: Date.now()
  }
];

// Endpoint para recibir datos de DataWedge
// Endpoint para actualizar destino y numeroCajas de cada andén
app.post('/api/andenes/update', (req, res) => {
  const { updates } = req.body; // [{id, destino, numeroCajas}]
  if (!Array.isArray(updates)) {
    return res.status(400).json({ error: 'Formato de datos incorrecto' });
  }
  updates.forEach(update => {
    const idx = andenes.findIndex(a => a.id === Number(update.id));
    if (idx !== -1) {
      if (update.destino !== undefined && update.destino.trim() !== '') {
        andenes[idx].destino = update.destino;
      }
      if (update.numeroCajas !== undefined && !isNaN(Number(update.numeroCajas))) {
        andenes[idx].numeroCajas = Number(update.numeroCajas);
      }
    }
  });
  res.json({ success: true });
});
app.post('/api/scan', (req, res) => {
  console.log('Escaneo recibido en /api/scan:', req.body);
  const { anden, ubicacion, numeroParte, destino, numeroCajas, codigoPallet } = req.body;
  // Si no se reciben los datos esperados, solo loguea y responde
  if (!anden || !ubicacion || !numeroParte) {
    return res.json({ success: true, info: 'Datos no procesados, formato inesperado' });
  }
  // ...procesamiento normal...
  const idx = andenes.findIndex(a => a.id === Number(anden));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  if (destino && destino.trim() !== '' && destino.trim().toLowerCase() !== 'sin definir') {
    andenes[idx].destino = destino;
  }
  if (typeof numeroCajas === 'number') {
    andenes[idx].numeroCajas = numeroCajas;
  }
  const pallet = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ubicacion,
    numeroParte,
    codigoPallet,
    timestamp: Date.now()
  };
  andenes[idx].pallets.push(pallet);
  andenes[idx].cantidad = andenes[idx].pallets.length;
  andenes[idx].ultimaFechaEscaneo = pallet.timestamp;
  if (andenes[idx].cantidad >= 30) {
    andenes[idx].status = 'Completado';
  } else if (andenes[idx].cantidad > 0) {
    andenes[idx].status = 'On going';
  } else {
    andenes[idx].status = 'En espera';
  }
  res.json({ success: true });
});

// Endpoint alternativo para escaneos desde DataWedge sin path
app.post('/', (req, res) => {
  console.log('Escaneo recibido en /:', req.body);
  const { anden, ubicacion, numeroParte, destino, numeroCajas, codigoPallet } = req.body;
  // Si no se reciben los datos esperados, solo loguea y responde
  if (!anden || !ubicacion || !numeroParte) {
    return res.json({ success: true, info: 'Datos no procesados, formato inesperado' });
  }
  // ...procesamiento normal...
  const idx = andenes.findIndex(a => a.id === Number(anden));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  if (destino && destino.trim() !== '' && destino.trim().toLowerCase() !== 'sin definir') {
    andenes[idx].destino = destino;
  }
  if (typeof numeroCajas === 'number') {
    andenes[idx].numeroCajas = numeroCajas;
  }
  const pallet = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ubicacion,
    numeroParte,
    codigoPallet,
    timestamp: Date.now()
  };
  andenes[idx].pallets.push(pallet);
  andenes[idx].cantidad = andenes[idx].pallets.length;
  andenes[idx].ultimaFechaEscaneo = pallet.timestamp;
  if (andenes[idx].cantidad >= 30) {
    andenes[idx].status = 'Completado';
  } else if (andenes[idx].cantidad > 0) {
    andenes[idx].status = 'On going';
  } else {
    andenes[idx].status = 'En espera';
  }
  res.json({ success: true });
});

// Endpoint para consultar datos desde el frontend
app.get('/api/andenes', (req, res) => {
  res.json(andenes);
});

app.listen(PORT, () => {
  console.log(`Backend escuchando en puerto ${PORT}`);
});

// Servidor TCP para recibir datos directos (por ejemplo, desde IPWedge)
const net = require('net');
const TCP_PORT = 4040;
const tcpServer = net.createServer(socket => {
  socket.on('data', data => {
    let tipo = 'desconocido';
    let contenido = data.toString();
    let json = null;
    try {
      json = JSON.parse(contenido);
      tipo = 'JSON';
    } catch {
      if (/^[\x20-\x7E\r\n]+$/.test(contenido)) {
        tipo = 'texto plano';
      } else {
        tipo = 'binario';
      }
    }
    console.log(`Dato TCP recibido (${tipo}):`, contenido);
    // Unificar estructura del pallet integrado por TCP
    if (tipo === 'JSON' && json != null) {
      let pallet = {
        id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        ubicacion: 'A1',
        numeroParte: '-',
        codigoPallet: '',
        timestamp: Date.now()
      };
      if (typeof json === 'object' && !Array.isArray(json)) {
        // Si es objeto, usar sus campos si existen
        pallet.ubicacion = json.ubicacion || 'A1';
        pallet.codigoPallet = json.codigoPallet || json.codigo || json.barcode || '-';
        pallet.numeroParte = pallet.codigoPallet;
      } else {
        // Si es valor simple, usar como codigoPallet y numeroParte
        const codigo = String(json).trim();
        pallet.codigoPallet = codigo !== '' ? codigo : '-';
        pallet.numeroParte = pallet.codigoPallet;
      }
      andenes[0].pallets.push(pallet);
      andenes[0].cantidad = andenes[0].pallets.length;
      andenes[0].ultimaFechaEscaneo = pallet.timestamp;
      if (andenes[0].cantidad >= 30) {
        andenes[0].status = 'Completado';
      } else if (andenes[0].cantidad > 0) {
        andenes[0].status = 'On going';
      } else {
        andenes[0].status = 'En espera';
      }
      console.log('Pallet integrado en Anden 1:', pallet);
    }
  });
  socket.on('error', err => {
    console.log('Error en conexión TCP:', err);
  });
});
tcpServer.listen(TCP_PORT, () => {
  console.log(`Servidor TCP escuchando en puerto ${TCP_PORT}`);
});
