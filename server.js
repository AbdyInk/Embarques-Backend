const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.use(express.json());

// --- Autenticación JWT ---
const jwt = require('jsonwebtoken');
const JWT_SECRET = 'culligan_secret_2025'; // Cambia esto en producción

// Usuarios de prueba (en memoria)
const usuarios = [
  { usuario: 'admin', password: 'admin123' },
  { usuario: 'operador', password: 'operador123' }
];

// Endpoint de login
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body;
  const user = usuarios.find(u => u.usuario === usuario && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }
  // Generar token
  const token = jwt.sign({ usuario: user.usuario }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token });
});

// Middleware para proteger rutas
function autenticarJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Token requerido' });
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Ejemplo de ruta protegida
app.get('/api/protegido', autenticarJWT, (req, res) => {
  res.json({ mensaje: 'Acceso autorizado', usuario: req.user.usuario });
});

// Historial de escaneos por anden (máximo 30 por anden)
const historialEscaneos = {};

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
  // Guardar en historial
  if (!historialEscaneos[andenes[idx].id]) historialEscaneos[andenes[idx].id] = [];
  historialEscaneos[andenes[idx].id].unshift({ id: pallet.id, ubicacion: pallet.ubicacion, numeroParte: pallet.numeroParte, codigoPallet: pallet.codigoPallet, timestamp: pallet.timestamp });
  if (historialEscaneos[andenes[idx].id].length > 30) historialEscaneos[andenes[idx].id] = historialEscaneos[andenes[idx].id].slice(0, 30);
  if (andenes[idx].cantidad >= 30) {
    andenes[idx].status = 'Completado';
  } else if (andenes[idx].cantidad > 0) {
    andenes[idx].status = 'On going';
  } else {
    andenes[idx].status = 'En espera';
  }
// Endpoint para registrar un escaneo en un anden
app.post('/api/andenes/:id/scan', (req, res) => {
  const andenId = Number(req.params.id);
  const { id, ubicacion, numeroParte, codigoPallet, timestamp } = req.body;
  if (!id || !ubicacion || !numeroParte || !codigoPallet || !timestamp) {
    return res.status(400).json({ error: 'Datos de escaneo incompletos' });
  }
  // Actualizar datos del anden
  const idx = andenes.findIndex(a => a.id === andenId);
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  const pallet = { id, ubicacion, numeroParte, codigoPallet, timestamp };
  andenes[idx].pallets.push(pallet);
  andenes[idx].cantidad = andenes[idx].pallets.length;
  andenes[idx].ultimaFechaEscaneo = timestamp;
  if (andenes[idx].cantidad >= 30) {
    andenes[idx].status = 'Completado';
  } else if (andenes[idx].cantidad > 0) {
    andenes[idx].status = 'On going';
  } else {
    andenes[idx].status = 'En espera';
  }
  // Guardar en historial
  if (!historialEscaneos[andenId]) historialEscaneos[andenId] = [];
  historialEscaneos[andenId].unshift({ id, ubicacion, numeroParte, codigoPallet, timestamp });
  // Limitar a 30 escaneos
  if (historialEscaneos[andenId].length > 30) historialEscaneos[andenId] = historialEscaneos[andenId].slice(0, 30);
  res.json({ success: true });
});

  res.json({ success: true });
});
    // Endpoint para obtener historial de escaneos de un anden
// Endpoint para obtener historial de escaneos de un anden
app.get('/api/andenes/:id/historial', (req, res) => {
  const andenId = Number(req.params.id);
  const historial = historialEscaneos[andenId] || [];
  res.json({ historial });
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
    const andenObj = andenes[idx];
    if (andenObj.cantidad >= 30) {
      // Rechazar escaneo extra
      if (andenObj.status !== 'Limite ya alcanzado') {
        andenObj.status = 'Limite ya alcanzado';
        setTimeout(() => {
          andenObj.status = 'Completado';
        }, 2000); // 2 segundos
      }
      return res.status(400).json({ error: 'Limite de escaneos alcanzado' });
    }
    if (destino && destino.trim() !== '' && destino.trim().toLowerCase() !== 'sin definir') {
      andenObj.destino = destino;
    }
    if (typeof numeroCajas === 'number') {
      andenObj.numeroCajas = numeroCajas;
    }
    const pallet = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      ubicacion,
      numeroParte,
      codigoPallet,
      timestamp: Date.now()
    };
    andenObj.pallets.push(pallet);
    andenObj.cantidad = andenObj.pallets.length;
    andenObj.ultimaFechaEscaneo = pallet.timestamp;
    if (andenObj.cantidad >= 30) {
      andenObj.status = 'Completado';
    } else if (andenObj.cantidad > 0) {
      andenObj.status = 'On going';
    } else {
      andenObj.status = 'En espera';
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
let tcpAndenIndex = 0; // Por defecto, Anden 1 (índice 0)

// Permitir cambiar el andén destino por consola
process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
  const match = input.trim().match(/^anden\s+(\d)$/i);
  if (match) {
    const num = Number(match[1]);
    if (num >= 1 && num <= andenes.length) {
      tcpAndenIndex = num - 1;
      console.log(`Destino de escaneos TCP cambiado a Anden ${num}`);
    } else {
      console.log('Número de anden fuera de rango (1-6)');
    }
  }
});

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
      const anden = andenes[tcpAndenIndex];
      if (anden.cantidad >= 30) {
        // Rechazar escaneo extra
        if (anden.status !== 'Limite ya alcanzado') {
          anden.status = 'Limite ya alcanzado';
          console.log(`Límite alcanzado en Anden ${tcpAndenIndex + 1}, escaneo rechazado.`);
          setTimeout(() => {
            anden.status = 'Completado';
          }, 2000); // 2 segundos
        }
        return; // No agregar pallet
      }
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
      anden.pallets.push(pallet);
      anden.cantidad = anden.pallets.length;
      anden.ultimaFechaEscaneo = pallet.timestamp;
      if (anden.cantidad >= 30) {
        anden.status = 'Completado';
      } else if (anden.cantidad > 0) {
        anden.status = 'On going';
      } else {
        anden.status = 'En espera';
      }
      // Guardar en historial
      if (!historialEscaneos[anden.id]) historialEscaneos[anden.id] = [];
      historialEscaneos[anden.id].unshift({
        id: pallet.id,
        ubicacion: pallet.ubicacion,
        numeroParte: pallet.numeroParte,
        codigoPallet: pallet.codigoPallet,
        timestamp: pallet.timestamp
      });
      if (historialEscaneos[anden.id].length > 30) historialEscaneos[anden.id] = historialEscaneos[anden.id].slice(0, 30);
      console.log(`Pallet integrado en Anden ${tcpAndenIndex + 1}:`, pallet);
    }
  });
  socket.on('error', err => {
    console.log('Error en conexión TCP:', err);
  });
});
tcpServer.listen(TCP_PORT, () => {
  console.log(`Servidor TCP escuchando en puerto ${TCP_PORT}`);
  console.log('Para cambiar el anden destino de escaneos TCP, escribe: anden <número>');
});
