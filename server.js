// --- Historial completo de ciclos por anden (simulado en archivo) ---
const fs = require('fs');
const HISTORIAL_PATH = __dirname + '/andenesHistorial.json';
let historialCiclos = [];
try {
  if (fs.existsSync(HISTORIAL_PATH)) {
    historialCiclos = JSON.parse(fs.readFileSync(HISTORIAL_PATH, 'utf8'));
  }
} catch (e) { historialCiclos = []; }
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());

app.use(express.json());
app.use('/api/tcp', express.text());

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
  // Generar token (expira en 3 horas)
  const token = jwt.sign({ usuario: user.usuario }, JWT_SECRET, { expiresIn: '3h' });
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

// Historial global de movimientos (escaneos y cambios de status)
let historialMovimientos = [
  // 7 escaneos
  ...Array.from({length: 7}, (_, i) => ({
    fechaHora: Date.now() - 1000 * 60 * (20 - i),
    anden: (i % 6) + 1,
    tipo: 'escaneo',
    codigo: `CP-TEST${i+1}`,
    usuario: 'admin',
    info: `Escaneo de pallet de prueba ${i+1}`
  })),
  // 7 cambios de status
  ...Array.from({length: 7}, (_, i) => ({
    fechaHora: Date.now() - 1000 * 60 * (13 - i),
    anden: ((i+2) % 6) + 1,
    tipo: 'status',
    codigo: ['Completado','Cargando','En espera','Documentado','Embarcado','Disponible','Limite'][i % 7],
    usuario: 'admin',
    info: `Cambio de status de prueba ${i+1}`
  })),
  // 6 cambios en anden
  ...Array.from({length: 6}, (_, i) => ({
    fechaHora: Date.now() - 1000 * 60 * (6 - i),
    anden: ((i+3) % 6) + 1,
    tipo: 'cambio',
    codigo: `Campo${i+1}`,
    usuario: 'admin',
    info: `Cambio en campo del andén de prueba ${i+1}`
  }))
];

// Almacenamiento en memoria de pallets por anden
let andenes = [
  {
    id: 1,
    pallets: Array.from({ length: 28 }, (_, i) => ({
      id: `p${i+1+200}`,
      ubicacion: 'A1',
      numeroParte: `P-100${i}`,
      codigoPallet: `CP-${i+200}`,
      timestamp: Date.now() - 1000 * 60 * (28 - i)
    })),
    numeroCajas: 16,
    cantidad: 28,
    limiteCamion: 28,
    status: 'Completado',
    destino: 'Dallas',
    ultimaFechaEscaneo: Date.now() - 1000 * 60
  },
  {
    id: 2,
    pallets: Array.from({ length: 30 }, (_, i) => ({
      id: `p${i+1+300}`,
      ubicacion: 'A2',
      numeroParte: `P-200${i}`,
      codigoPallet: `CP-${i+300}`,
      timestamp: Date.now() - 1000 * 60 * (30 - i)
    })),
    numeroCajas: 12,
    cantidad: 30,
    status: 'Documentado',
    destino: 'Toronto',
    ultimaFechaEscaneo: Date.now() - 1000 * 60 * 2
  },
  {
    id: 3,
    pallets: Array.from({ length: 30 }, (_, i) => ({
      id: `p${i+1+400}`,
      ubicacion: 'A3',
      numeroParte: `P-300${i}`,
      codigoPallet: `CP-${i+400}`,
      timestamp: Date.now() - 1000 * 60 * (30 - i)
    })),
    numeroCajas: 10,
    cantidad: 30,
    status: 'Embarcado',
    destino: 'Mc Allen',
    ultimaFechaEscaneo: Date.now() - 1000 * 60 * 3,
    fechaEmbarque: Date.now() - 1000 * 60 * 3
  },
  { id: 4, pallets: [], numeroCajas: 6, cantidad: 0, limiteCamion: 32, status: 'En espera', destino: 'Mc Allen', ultimaFechaEscaneo: null },
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

// Al iniciar el servidor, programar reset para cualquier andén en 'Embarcado'
andenes.forEach((anden, idx) => {
  if (anden.status === 'Embarcado') {
    setTimeout(() => {
      andenes[idx].pallets = [];
      andenes[idx].cantidad = 0;
      andenes[idx].status = 'Disponible';
      andenes[idx].destino = '';
      andenes[idx].numeroCajas = 0;
      andenes[idx].limiteCamion = 0;
      andenes[idx].ultimaFechaEscaneo = null;
      andenes[idx].horaInicioEscaneo = null;
      andenes[idx].horaCompletado = null;
      andenes[idx].horaDocumentado = null;
      andenes[idx].horaEmbarcado = null;
      andenes[idx].usuarioDocumenta = null;
      andenes[idx].usuarioEmbarca = null;
      historialMovimientos.unshift({
        fechaHora: Date.now(),
        anden: andenes[idx].id,
        tipo: 'status',
        codigo: 'Disponible',
        usuario: 'Sistema',
        info: 'Cambio automático tras embarque'
      });
      if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
      console.log(`Andén ${anden.id} reseteado automáticamente a 'Disponible' tras inicio del servidor.`);
    }, 1 * 60 * 1000);
  }
});
// ...existing code...
// Endpoint para editar datos de un andén (para /cuadricula)
app.put('/api/andenes/:id', (req, res) => {
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Andén no encontrado' });
  const { status, destino, numeroCajas, limiteCamion } = req.body;
  let cambio = false;
  if (status !== undefined && typeof status === 'string') {
    andenes[idx].status = status;
    cambio = true;
    historialMovimientos.unshift({
      fechaHora: Date.now(),
      anden: andenes[idx].id,
      tipo: 'status',
      codigo: status,
      usuario: 'admin',
      info: 'Cambio manual desde PUT /api/andenes/:id'
    });
  }
  if (destino !== undefined && typeof destino === 'string') {
    andenes[idx].destino = destino;
    cambio = true;
    historialMovimientos.unshift({
      fechaHora: Date.now(),
      anden: andenes[idx].id,
      tipo: 'destino',
      codigo: destino,
      usuario: 'admin',
      info: 'Cambio manual desde PUT /api/andenes/:id'
    });
  }
  if (numeroCajas !== undefined && !isNaN(Number(numeroCajas))) {
    andenes[idx].numeroCajas = Number(numeroCajas);
    cambio = true;
    historialMovimientos.unshift({
      fechaHora: Date.now(),
      anden: andenes[idx].id,
      tipo: 'numeroCajas',
      codigo: numeroCajas,
      usuario: 'admin',
      info: 'Cambio manual desde PUT /api/andenes/:id'
    });
  }
  if (limiteCamion !== undefined && !isNaN(Number(limiteCamion))) {
    if (Number(limiteCamion) !== Number(andenes[idx].limiteCamion)) {
      andenes[idx].limiteCamion = Number(limiteCamion);
      cambio = true;
      historialMovimientos.unshift({
        fechaHora: Date.now(),
        anden: andenes[idx].id,
        tipo: 'limiteCamion',
        codigo: limiteCamion,
        usuario: 'admin',
        info: 'Cambio manual desde PUT /api/andenes/:id'
      });
    }
  }
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  res.json({ success: true, anden: andenes[idx] });
});
app.post('/api/scan', (req, res) => {
  console.log('Escaneo recibido en /api/scan:', req.body);
  const { anden, ubicacion, numeroParte, destino, numeroCajas, codigoPallet } = req.body;
  // Si faltan datos, usar valores por defecto
  const idx = andenes.findIndex(a => a.id === Number(anden));
  const defaultAnden = idx !== -1 ? andenes[idx] : andenes[0];
  const pallet = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ubicacion: ubicacion || `A${defaultAnden.id}`,
    numeroParte: numeroParte || '-',
    codigoPallet: codigoPallet || '-',
    timestamp: Date.now()
  };
  defaultAnden.pallets.push(pallet);
  defaultAnden.cantidad = defaultAnden.pallets.length;
  defaultAnden.ultimaFechaEscaneo = pallet.timestamp;
  if (destino && destino.trim() !== '' && destino.trim().toLowerCase() !== 'sin definir') {
    defaultAnden.destino = destino;
  }
  if (typeof numeroCajas === 'number') {
    defaultAnden.numeroCajas = numeroCajas;
  }
  // Guardar en historial por andén
  if (!historialEscaneos[defaultAnden.id]) historialEscaneos[defaultAnden.id] = [];
  historialEscaneos[defaultAnden.id].unshift({ id: pallet.id, ubicacion: pallet.ubicacion, numeroParte: pallet.numeroParte, codigoPallet: pallet.codigoPallet, timestamp: pallet.timestamp });
  if (historialEscaneos[defaultAnden.id].length > 30) historialEscaneos[defaultAnden.id] = historialEscaneos[defaultAnden.id].slice(0, 30);
  // Guardar en historial global de movimientos como escaneo
  historialMovimientos.unshift({
    fechaHora: pallet.timestamp,
    anden: defaultAnden.id,
    tipo: 'escaneo',
    codigo: pallet.codigoPallet,
    usuario: 'admin',
    info: 'Escaneo registrado en /api/scan'
  });
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  // Guardar cambio de status en historial global si corresponde
  let nuevoStatus = '';
  if (defaultAnden.cantidad >= 30) {
    defaultAnden.status = 'Completado';
    nuevoStatus = 'Completado';
  } else if (defaultAnden.cantidad > 0) {
    defaultAnden.status = 'Cargando';
    nuevoStatus = 'Cargando';
  } else {
    defaultAnden.status = 'En espera';
    nuevoStatus = 'En espera';
  }
  historialMovimientos.unshift({
    fechaHora: Date.now(),
    anden: defaultAnden.id,
    tipo: 'status',
    codigo: nuevoStatus,
    usuario: 'Sistema',
    info: `Cambio de status por escaneo en /api/scan`
  });
  res.json({ success: true });
});

// Endpoint para historial global de movimientos (debe ir antes de cualquier catch-all)
app.get('/api/historial', (req, res) => {
  let { limit, offset } = req.query;
  limit = Number(limit) || 20;
  offset = Number(offset) || 0;
  res.json(historialMovimientos.slice(offset, offset + limit));
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
      andenObj.status = 'Cargando';
    } else {
      andenObj.status = 'En espera';
    }
    res.json({ success: true });
  });

// Endpoint para consultar datos desde el frontend
app.get('/api/andenes', (req, res) => {
  res.json(andenes);
});

// Endpoint global para historial de escaneos de todos los andenes
app.get('/api/escaneos', (req, res) => {
  // Devuelve un objeto con el historial de cada anden
  res.json({ historial: historialEscaneos });
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
        json = contenido.trim();
      } else {
        tipo = 'binario';
      }
    }
    console.log(`Dato TCP recibido (${tipo}):`, contenido);
    // Unificar estructura del pallet integrado por TCP (JSON o texto plano)
    if ((tipo === 'JSON' && json != null) || tipo === 'texto plano') {
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
        anden.status = 'Cargando';
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

// --- TCP plano ---
app.post('/api/tcp', (req, res) => {
  let body = req.body;
  let json = null;
  // Si recibimos texto plano, transformar a JSON con formato estándar
  if (typeof body === 'string') {
    // Si es solo números o texto, crear objeto igual que el flujo JSON
    json = { codigoPallet: body.trim(), ubicacion: 'A1' };
  } else {
    json = body;
  }
  // Unificar registro
  let pallet = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    ubicacion: 'A1',
    numeroParte: '-',
    codigoPallet: '',
    timestamp: Date.now()
  };
  if (typeof json === 'object' && !Array.isArray(json)) {
    pallet.ubicacion = json.ubicacion || 'A1';
    pallet.codigoPallet = json.codigoPallet || json.codigo || json.barcode || '-';
    pallet.numeroParte = pallet.codigoPallet;
  } else {
    const codigo = String(json).trim();
    pallet.codigoPallet = codigo !== '' ? codigo : '-';
    pallet.numeroParte = pallet.codigoPallet;
  }
  // Guardar en el primer andén disponible
  const idx = andenes.findIndex(a => a.status !== 'Completado' && a.status !== 'Limite ya alcanzado');
  if (idx === -1) return res.status(400).json({ error: 'No hay andenes disponibles' });
  pallet.ubicacion = `A${andenes[idx].id}`;
  andenes[idx].pallets.push(pallet);
  andenes[idx].cantidad = andenes[idx].pallets.length;
  andenes[idx].ultimaFechaEscaneo = pallet.timestamp;
  if (!historialEscaneos[andenes[idx].id]) historialEscaneos[andenes[idx].id] = [];
  historialEscaneos[andenes[idx].id].unshift({ id: pallet.id, ubicacion: pallet.ubicacion, numeroParte: pallet.numeroParte, codigoPallet: pallet.codigoPallet, timestamp: pallet.timestamp });
  if (historialEscaneos[andenes[idx].id].length > 30) historialEscaneos[andenes[idx].id] = historialEscaneos[andenes[idx].id].slice(0, 30);
  if (andenes[idx].cantidad >= 30) {
    andenes[idx].status = 'Completado';
  } else if (andenes[idx].cantidad > 0) {
    andenes[idx].status = 'Cargando';
  } else {
    andenes[idx].status = 'En espera';
  }
  console.log(`Pallet integrado en Anden ${andenes[idx].id}:`, pallet);
  return res.json({ success: true, info: 'TCP registrado', anden: andenes[idx].id, pallet });
});

// Endpoint para cambiar destino
app.post('/api/andenes/:id/destino', (req, res) => {
  const { destino } = req.body;
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  andenes[idx].destino = destino;
  historialMovimientos.unshift({
    fechaHora: Date.now(),
    anden: andenes[idx].id,
    tipo: 'destino',
    codigo: destino,
    usuario: 'admin',
    info: 'Cambio de destino en /api/andenes/:id/destino'
  });
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  res.json({ success: true });
});

// Endpoint para cambiar número de caja del camión
app.post('/api/andenes/:id/caja', (req, res) => {
  const { numeroCajaCamion } = req.body;
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  andenes[idx].numeroCajaCamion = numeroCajaCamion;
  historialMovimientos.unshift({
    fechaHora: Date.now(),
    anden: andenes[idx].id,
    tipo: 'numeroCajas',
    codigo: numeroCajaCamion,
    usuario: 'admin',
    info: 'Cambio de número de caja en /api/andenes/:id/caja'
  });
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  res.json({ success: true });
});

// Endpoint para cambiar límite de tarimas por camión
app.post('/api/andenes/:id/limite', (req, res) => {
  const { limiteCamion } = req.body;
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  andenes[idx].limiteCamion = limiteCamion;
  historialMovimientos.unshift({
    fechaHora: Date.now(),
    anden: andenes[idx].id,
    tipo: 'limiteCamion',
    codigo: limiteCamion,
    usuario: 'admin',
    info: 'Cambio de límite de tarimas en /api/andenes/:id/limite'
  });
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  res.json({ success: true });
});

// Endpoint para registrar pallet (tarima)
app.post('/api/andenes/:id/pallet', (req, res) => {
  const { numeroParte, piezas } = req.body;
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  const pallet = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    numeroParte,
    piezas,
    horaEscaneo: Date.now()
  };
  andenes[idx].pallets.push(pallet);
  andenes[idx].cantidadTarimas = andenes[idx].pallets.length;
  // Registrar en historial global de movimientos como escaneo
  historialMovimientos.unshift({
    fechaHora: pallet.horaEscaneo,
    anden: andenes[idx].id,
    tipo: 'escaneo',
    codigo: pallet.numeroParte,
    usuario: 'admin',
    info: 'Escaneo registrado en /api/andenes/:id/pallet'
  });
  if (historialMovimientos.length > 100) historialMovimientos = historialMovimientos.slice(0, 100);
  if (andenes[idx].cantidadTarimas >= (andenes[idx].limiteCamion || 30)) {
    andenes[idx].status = 'Completado';
    andenes[idx].horaCompletado = Date.now();
    // Registrar cambio de status en historial (automático)
    historialMovimientos.unshift({
      fechaHora: Date.now(),
      anden: andenes[idx].id,
      tipo: 'status',
      codigo: 'Completado',
      usuario: 'Sistema'
    });
  } else {
    andenes[idx].status = 'Cargando';
    historialMovimientos.unshift({
      fechaHora: Date.now(),
      anden: andenes[idx].id,
      tipo: 'status',
      codigo: 'Cargando',
      usuario: 'Sistema'
    });
  }
  res.json({ success: true, pallet });
});

// Endpoint para marcar como completado
app.post('/api/andenes/:id/completar', (req, res) => {
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  andenes[idx].status = 'Completado';
  andenes[idx].horaCompletado = Date.now();
  res.json({ success: true });
});

// Endpoint para marcar como documentado y registrar usuario
app.post('/api/andenes/:id/documentar', (req, res) => {
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  const usuario = req.body.usuario || 'desconocido';
  andenes[idx].status = 'Documentado';
  andenes[idx].horaDocumentado = Date.now();
  andenes[idx].usuarioDocumenta = usuario;
  // Programar cambio a embarcado en 5 minutos
  setTimeout(() => {
    andenes[idx].status = 'Embarcado';
    andenes[idx].horaEmbarcado = Date.now();
    andenes[idx].usuarioEmbarca = usuario;
    // Guardar ciclo en historial y limpiar andén
    const ciclo = {
      id: andenes[idx].id,
      destino: andenes[idx].destino,
      numeroCajas: andenes[idx].numeroCajas,
      pallets: [...andenes[idx].pallets],
      horaInicioEscaneo: andenes[idx].horaInicioEscaneo,
      horaCompletado: andenes[idx].horaCompletado,
      horaDocumentado: andenes[idx].horaDocumentado,
      horaEmbarcado: andenes[idx].horaEmbarcado,
      usuarioDocumenta: andenes[idx].usuarioDocumenta,
      usuarioEmbarca: andenes[idx].usuarioEmbarca
    };
    historialCiclos.push(ciclo);
    try {
      fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historialCiclos, null, 2));
    } catch(e) { console.error('Error guardando historial:', e); }
    // Limpiar andén para nuevo ciclo
    andenes[idx].pallets = [];
    andenes[idx].cantidad = 0;
    andenes[idx].status = 'En espera';
    andenes[idx].destino = '';
    andenes[idx].numeroCajas = 0;
    andenes[idx].ultimaFechaEscaneo = null;
    andenes[idx].horaInicioEscaneo = null;
    andenes[idx].horaCompletado = null;
    andenes[idx].horaDocumentado = null;
    andenes[idx].horaEmbarcado = null;
    andenes[idx].usuarioDocumenta = null;
    andenes[idx].usuarioEmbarca = null;
  }, 5 * 60 * 1000);
  res.json({ success: true });
});

// Endpoint para marcar como embarcado (manual) y guardar ciclo
app.post('/api/andenes/:id/embarcar', (req, res) => {
  const idx = andenes.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Anden no encontrado' });
  const usuario = req.body.usuario || 'desconocido';
  andenes[idx].status = 'Embarcado';
  andenes[idx].horaEmbarcado = Date.now();
  andenes[idx].usuarioEmbarca = usuario;
  // Guardar ciclo en historial
  const ciclo = {
    id: andenes[idx].id,
    destino: andenes[idx].destino,
    numeroCajas: andenes[idx].numeroCajas,
    pallets: [...andenes[idx].pallets],
    horaInicioEscaneo: andenes[idx].horaInicioEscaneo,
    horaCompletado: andenes[idx].horaCompletado,
    horaDocumentado: andenes[idx].horaDocumentado,
    horaEmbarcado: andenes[idx].horaEmbarcado,
    usuarioDocumenta: andenes[idx].usuarioDocumenta,
    usuarioEmbarca: andenes[idx].usuarioEmbarca
  };
  historialCiclos.push(ciclo);
  try {
    fs.writeFileSync(HISTORIAL_PATH, JSON.stringify(historialCiclos, null, 2));
  } catch(e) { console.error('Error guardando historial:', e); }
  // Programar reset automático a 'Disponible' en 1 minuto (pruebas)
  setTimeout(() => {
    andenes[idx].pallets = [];
    andenes[idx].cantidad = 0;
    andenes[idx].status = 'Disponible';
    andenes[idx].destino = '';
    andenes[idx].numeroCajas = 0;
    andenes[idx].limiteCamion = 0;
    andenes[idx].ultimaFechaEscaneo = null;
    andenes[idx].horaInicioEscaneo = null;
    andenes[idx].horaCompletado = null;
    andenes[idx].horaDocumentado = null;
    andenes[idx].horaEmbarcado = null;
    andenes[idx].usuarioDocumenta = null;
    andenes[idx].usuarioEmbarca = null;
  }, 15 * 60 * 1000);
  res.json({ success: true });
});
// Endpoint para consultar historial completo de ciclos por andén
app.get('/api/andenes/:id/historial', (req, res) => {
  const andenId = Number(req.params.id);
  const historial = historialCiclos.filter(c => c.id === andenId);
  res.json({ historial });
});
