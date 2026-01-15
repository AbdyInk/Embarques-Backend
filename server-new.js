require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const fs = require('fs');
const path = require('path');
const db = require('./database/connection');

const app = express();
const PORT = process.env.PORT || 4000;

// Configuración de seguridad para producción
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // máximo 100 requests por ventana
});
app.use(limiter);

// CORS configurado desde variables de entorno
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json());
app.use('/api/tcp', express.text());

// Configuración JWT desde variables de entorno
const JWT_SECRET = process.env.JWT_SECRET || 'culligan_secret_2025_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Crear directorio de logs si no existe
const logDir = path.join(__dirname, process.env.LOG_DIR || './logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Logger básico (en producción usar Winston)
const log = {
  info: (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `${timestamp} [INFO] ${msg}`;
    console.log(logMsg);
    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(path.join(logDir, 'app.log'), logMsg + '\n');
    }
  },
  error: (msg) => {
    const timestamp = new Date().toISOString();
    const logMsg = `${timestamp} [ERROR] ${msg}`;
    console.error(logMsg);
    if (process.env.NODE_ENV === 'production') {
      fs.appendFileSync(path.join(logDir, 'error.log'), logMsg + '\n');
    }
  }
};

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbStatus = await db.testConnection();
    res.json({
      status: 'healthy',
      database: dbStatus ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Middleware de autenticación JWT
function autenticarJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  
  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      log.error(`Token inválido: ${err.message}`);
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.user = user;
    next();
  });
}

// Middleware para verificar permisos de administrador
function requireAdmin(req, res, next) {
  if (req.user.grupo !== 'administrador') {
    log.error(`Usuario ${req.user.usuario} intentó acceder a ruta de admin`);
    return res.status(403).json({ error: 'Se requieren permisos de administrador' });
  }
  next();
}

// Validaciones de usuario
function validarUsuario(usuario) {
  const errores = [];
  
  if (!usuario.usuario || usuario.usuario.length < 3) {
    errores.push('El nombre de usuario debe tener al menos 3 caracteres');
  }
  
  if (usuario.password && usuario.password.length < 6) {
    errores.push('La contraseña debe tener al menos 6 caracteres');
  }
  
  if (!['operador', 'administrador'].includes(usuario.grupo)) {
    errores.push('El grupo debe ser operador o administrador');
  }
  
  return errores;
}

// ==================== ENDPOINTS DE AUTENTICACIÓN ====================

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }

    const user = await db.query(`
      SELECT Id, Usuario, Grupo, Activo 
      FROM Usuarios 
      WHERE Usuario = @usuario AND Password = @password AND Activo = 1
    `, { usuario, password });

    if (!user.recordset || user.recordset.length === 0) {
      log.error(`Intento de login fallido para usuario: ${usuario}`);
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const userData = user.recordset[0];
    
    // Generar token
    const token = jwt.sign({
      id: userData.Id,
      usuario: userData.Usuario,
      grupo: userData.Grupo
    }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    log.info(`Usuario ${userData.Usuario} autenticado exitosamente`);
    
    res.json({
      token,
      usuario: {
        id: userData.Id,
        usuario: userData.Usuario,
        grupo: userData.Grupo
      }
    });
  } catch (error) {
    log.error(`Error en login: ${error.message}`);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ==================== ENDPOINTS DE USUARIOS ====================

// GET /api/usuarios - Listar usuarios (solo admin)
app.get('/api/usuarios', autenticarJWT, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT Id, Usuario, Grupo, Activo, FechaCreacion 
      FROM Usuarios 
      ORDER BY Id
    `);

    res.json(result.recordset);
  } catch (error) {
    log.error(`Error obteniendo usuarios: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/usuarios - Crear usuario (solo admin)
app.post('/api/usuarios', autenticarJWT, requireAdmin, async (req, res) => {
  try {
    const { usuario, password, grupo } = req.body;
    
    // Validar datos
    const errores = validarUsuario({ usuario, password, grupo });
    if (errores.length > 0) {
      return res.status(400).json({ error: errores.join(', ') });
    }

    // Verificar si ya existe
    const existente = await db.query(`
      SELECT Id FROM Usuarios WHERE Usuario = @usuario
    `, { usuario });

    if (existente.recordset.length > 0) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese nombre' });
    }

    // Crear usuario
    const result = await db.query(`
      INSERT INTO Usuarios (Usuario, Password, Grupo, Activo, FechaCreacion)
      OUTPUT INSERTED.Id, INSERTED.Usuario, INSERTED.Grupo, INSERTED.Activo, INSERTED.FechaCreacion
      VALUES (@usuario, @password, @grupo, 1, GETDATE())
    `, { usuario, password, grupo });

    const nuevoUsuario = result.recordset[0];

    // Registrar en historial
    await db.query(`
      INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
      VALUES (NULL, 'usuario', @codigo, @usuarioAdmin, @info, GETDATE())
    `, {
      codigo: `Creado: ${usuario}`,
      usuarioAdmin: req.user.usuario,
      info: `Usuario ${usuario} creado con grupo ${grupo}`
    });

    log.info(`Usuario ${usuario} creado por ${req.user.usuario}`);
    
    res.status(201).json({
      mensaje: 'Usuario creado exitosamente',
      usuario: nuevoUsuario
    });
  } catch (error) {
    log.error(`Error creando usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/usuarios/:id - Actualizar usuario (solo admin)
app.put('/api/usuarios/:id', autenticarJWT, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { usuario, password, grupo, activo } = req.body;

    // Proteger usuarios por defecto
    if (id === 1 || id === 2) {
      return res.status(403).json({ error: 'No se pueden modificar los usuarios por defecto del sistema' });
    }

    // Verificar que existe
    const usuarioExistente = await db.query(`
      SELECT * FROM Usuarios WHERE Id = @id
    `, { id });

    if (usuarioExistente.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // No permitir desactivar su propia cuenta
    if (id === req.user.id && activo === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta' });
    }

    // Construir query de actualización dinámicamente
    const updates = [];
    const params = { id };

    if (usuario) {
      updates.push('Usuario = @usuario');
      params.usuario = usuario;
    }

    if (password) {
      updates.push('Password = @password');
      params.password = password;
    }

    if (grupo) {
      updates.push('Grupo = @grupo');
      params.grupo = grupo;
    }

    if (activo !== undefined) {
      updates.push('Activo = @activo');
      params.activo = activo;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No hay datos para actualizar' });
    }

    // Actualizar usuario
    const result = await db.query(`
      UPDATE Usuarios 
      SET ${updates.join(', ')}
      OUTPUT INSERTED.Id, INSERTED.Usuario, INSERTED.Grupo, INSERTED.Activo, INSERTED.FechaCreacion
      WHERE Id = @id
    `, params);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const usuarioActualizado = result.recordset[0];

    // Registrar en historial
    await db.query(`
      INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
      VALUES (NULL, 'usuario', @codigo, @usuarioAdmin, @info, GETDATE())
    `, {
      codigo: `Actualizado: ${usuarioActualizado.Usuario}`,
      usuarioAdmin: req.user.usuario,
      info: `Usuario ${usuarioActualizado.Usuario} actualizado`
    });

    log.info(`Usuario ${usuarioActualizado.Usuario} actualizado por ${req.user.usuario}`);
    
    res.json({
      mensaje: 'Usuario actualizado exitosamente',
      usuario: usuarioActualizado
    });
  } catch (error) {
    log.error(`Error actualizando usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario (solo admin)
app.delete('/api/usuarios/:id', autenticarJWT, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Proteger usuarios por defecto
    if (id === 1 || id === 2) {
      return res.status(403).json({ error: 'No se pueden eliminar los usuarios por defecto del sistema' });
    }

    // No permitir eliminarse a sí mismo
    if (id === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }

    // Obtener usuario antes de eliminar
    const usuario = await db.query(`
      SELECT Usuario FROM Usuarios WHERE Id = @id
    `, { id });

    if (usuario.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nombreUsuario = usuario.recordset[0].Usuario;

    // Eliminar usuario
    await db.query(`DELETE FROM Usuarios WHERE Id = @id`, { id });

    // Registrar en historial
    await db.query(`
      INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
      VALUES (NULL, 'usuario', @codigo, @usuarioAdmin, @info, GETDATE())
    `, {
      codigo: `Eliminado: ${nombreUsuario}`,
      usuarioAdmin: req.user.usuario,
      info: `Usuario ${nombreUsuario} eliminado del sistema`
    });

    log.info(`Usuario ${nombreUsuario} eliminado por ${req.user.usuario}`);
    
    res.json({ mensaje: 'Usuario eliminado exitosamente' });
  } catch (error) {
    log.error(`Error eliminando usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// GET /api/usuarios/me - Obtener datos del usuario actual
app.get('/api/usuarios/me', autenticarJWT, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT Id, Usuario, Grupo, Activo, FechaCreacion 
      FROM Usuarios 
      WHERE Id = @id
    `, { id: req.user.id });

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    log.error(`Error obteniendo datos del usuario: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener datos del usuario' });
  }
});

// ==================== ENDPOINTS DE ANDENES ====================

// GET /api/andenes - Obtener todos los andenes
app.get('/api/andenes', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT Id, Nombre, Status, LimiteCamion, Destino, NumeroCajas,
             UltimaFechaEscaneo, HoraInicioEscaneo, HoraCompletado,
             HoraDocumentado, HoraEmbarcado, UsuarioDocumenta, UsuarioEmbarca
      FROM Andenes
      ORDER BY Id
    `);

    res.json(result.recordset);
  } catch (error) {
    log.error(`Error obteniendo andenes: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener andenes' });
  }
});

// PUT /api/andenes/:id - Actualizar anden
app.put('/api/andenes/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, limiteCamion, destino } = req.body;

    // Verificar que el anden existe
    const andenExistente = await db.query(`
      SELECT * FROM Andenes WHERE Id = @id
    `, { id });

    if (andenExistente.recordset.length === 0) {
      return res.status(404).json({ error: 'Andén no encontrado' });
    }

    const anden = andenExistente.recordset[0];
    const updates = [];
    const params = { id };

    if (status) {
      updates.push('Status = @status');
      params.status = status;
    }

    if (limiteCamion !== undefined) {
      updates.push('LimiteCamion = @limiteCamion');
      params.limiteCamion = limiteCamion;
    }

    if (destino !== undefined) {
      updates.push('Destino = @destino');
      params.destino = destino;
    }

    if (updates.length > 0) {
      await db.query(`
        UPDATE Andenes 
        SET ${updates.join(', ')}
        WHERE Id = @id
      `, params);
    }

    // Registrar cambios en historial si hubo cambios significativos
    if (status && status !== anden.Status) {
      await db.query(`
        INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
        VALUES (@id, 'status', @status, 'admin', 'Cambio manual desde PUT /api/andenes/:id', GETDATE())
      `, { id, status });
    }

    if (limiteCamion !== undefined && limiteCamion !== anden.LimiteCamion) {
      await db.query(`
        INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
        VALUES (@id, 'limite', @limiteCamion, 'admin', 'Cambio de límite desde PUT /api/andenes/:id', GETDATE())
      `, { id, limiteCamion: limiteCamion.toString() });
    }

    // Obtener anden actualizado
    const result = await db.query(`
      SELECT * FROM Andenes WHERE Id = @id
    `, { id });

    res.json({ success: true, anden: result.recordset[0] });
  } catch (error) {
    log.error(`Error actualizando andén: ${error.message}`);
    res.status(500).json({ error: 'Error al actualizar andén' });
  }
});

// POST /api/andenes/:id/destino - Cambiar destino
app.post('/api/andenes/:id/destino', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { destino } = req.body;

    await db.query(`
      UPDATE Andenes SET Destino = @destino WHERE Id = @id
    `, { id, destino });

    // Registrar en historial
    await db.query(`
      INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
      VALUES (@id, 'destino', @destino, 'admin', 'Cambio de destino', GETDATE())
    `, { id, destino });

    res.json({ success: true });
  } catch (error) {
    log.error(`Error cambiando destino: ${error.message}`);
    res.status(500).json({ error: 'Error al cambiar destino' });
  }
});

// POST /api/andenes/:id/documentar - Marcar como documentado
app.post('/api/andenes/:id/documentar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { usuario } = req.body;

    await db.query(`
      UPDATE Andenes 
      SET Status = 'Documentado', 
          HoraDocumentado = GETDATE(), 
          UsuarioDocumenta = @usuario
      WHERE Id = @id
    `, { id, usuario: usuario || 'desconocido' });

    // Programar cambio a embarcado (esto se debería manejar con un job scheduler en producción)
    setTimeout(async () => {
      try {
        // Obtener datos del andén para el ciclo
        const anden = await db.query(`SELECT * FROM Andenes WHERE Id = @id`, { id });
        
        if (anden.recordset.length > 0) {
          const andenData = anden.recordset[0];
          
          // Actualizar a embarcado
          await db.query(`
            UPDATE Andenes 
            SET Status = 'Embarcado', 
                HoraEmbarcado = GETDATE(), 
                UsuarioEmbarca = @usuario
            WHERE Id = @id
          `, { id, usuario: usuario || 'desconocido' });

          // Guardar ciclo completo
          await db.query(`
            INSERT INTO HistorialCiclos (
              AndeneId, Status, LimiteCamion, Destino, NumeroCajas,
              UltimaFechaEscaneo, HoraInicioEscaneo, HoraCompletado,
              HoraDocumentado, HoraEmbarcado, UsuarioDocumenta, UsuarioEmbarca,
              FechaHora
            )
            VALUES (
              @id, @status, @limiteCamion, @destino, @numeroCajas,
              @ultimaFechaEscaneo, @horaInicioEscaneo, @horaCompletado,
              @horaDocumentado, GETDATE(), @usuarioDocumenta, @usuarioEmbarca,
              GETDATE()
            )
          `, {
            id,
            status: 'Embarcado',
            limiteCamion: andenData.LimiteCamion,
            destino: andenData.Destino,
            numeroCajas: andenData.NumeroCajas,
            ultimaFechaEscaneo: andenData.UltimaFechaEscaneo,
            horaInicioEscaneo: andenData.HoraInicioEscaneo,
            horaCompletado: andenData.HoraCompletado,
            horaDocumentado: andenData.HoraDocumentado,
            usuarioDocumenta: andenData.UsuarioDocumenta,
            usuarioEmbarca: usuario || 'desconocido'
          });

          // Limpiar andén
          await db.query(`
            UPDATE Andenes 
            SET Status = 'Disponible',
                LimiteCamion = 0,
                Destino = '',
                NumeroCajas = 0,
                UltimaFechaEscaneo = NULL,
                HoraInicioEscaneo = NULL,
                HoraCompletado = NULL,
                HoraDocumentado = NULL,
                HoraEmbarcado = NULL,
                UsuarioDocumenta = NULL,
                UsuarioEmbarca = NULL
            WHERE Id = @id
          `, { id });

          log.info(`Andén ${id} completó ciclo y fue reseteado automáticamente`);
        }
      } catch (error) {
        log.error(`Error en proceso automático de embarcado: ${error.message}`);
      }
    }, 5 * 60 * 1000); // 5 minutos

    res.json({ success: true });
  } catch (error) {
    log.error(`Error documentando andén: ${error.message}`);
    res.status(500).json({ error: 'Error al documentar andén' });
  }
});

// POST /api/andenes/:id/embarcar - Marcar como embarcado (manual)
app.post('/api/andenes/:id/embarcar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { usuario } = req.body;

    // Obtener datos del andén antes de limpiar
    const anden = await db.query(`SELECT * FROM Andenes WHERE Id = @id`, { id });
    
    if (anden.recordset.length === 0) {
      return res.status(404).json({ error: 'Andén no encontrado' });
    }

    const andenData = anden.recordset[0];

    // Actualizar a embarcado
    await db.query(`
      UPDATE Andenes 
      SET Status = 'Embarcado', 
          HoraEmbarcado = GETDATE(), 
          UsuarioEmbarca = @usuario
      WHERE Id = @id
    `, { id, usuario: usuario || 'desconocido' });

    // Guardar ciclo completo
    await db.query(`
      INSERT INTO HistorialCiclos (
        AndeneId, Status, LimiteCamion, Destino, NumeroCajas,
        UltimaFechaEscaneo, HoraInicioEscaneo, HoraCompletado,
        HoraDocumentado, HoraEmbarcado, UsuarioDocumenta, UsuarioEmbarca,
        FechaHora
      )
      VALUES (
        @id, 'Embarcado', @limiteCamion, @destino, @numeroCajas,
        @ultimaFechaEscaneo, @horaInicioEscaneo, @horaCompletado,
        @horaDocumentado, GETDATE(), @usuarioDocumenta, @usuarioEmbarca,
        GETDATE()
      )
    `, {
      id,
      limiteCamion: andenData.LimiteCamion,
      destino: andenData.Destino,
      numeroCajas: andenData.NumeroCajas,
      ultimaFechaEscaneo: andenData.UltimaFechaEscaneo,
      horaInicioEscaneo: andenData.HoraInicioEscaneo,
      horaCompletado: andenData.HoraCompletado,
      horaDocumentado: andenData.HoraDocumentado,
      usuarioDocumenta: andenData.UsuarioDocumenta,
      usuarioEmbarca: usuario || 'desconocido'
    });

    // Limpiar andén después de un breve delay
    setTimeout(async () => {
      try {
        await db.query(`
          UPDATE Andenes 
          SET Status = 'Disponible',
              LimiteCamion = 0,
              Destino = '',
              NumeroCajas = 0,
              UltimaFechaEscaneo = NULL,
              HoraInicioEscaneo = NULL,
              HoraCompletado = NULL,
              HoraDocumentado = NULL,
              HoraEmbarcado = NULL,
              UsuarioDocumenta = NULL,
              UsuarioEmbarca = NULL
          WHERE Id = @id
        `, { id });

        log.info(`Andén ${id} embarcado manualmente y reseteado`);
      } catch (error) {
        log.error(`Error limpiando andén después de embarque manual: ${error.message}`);
      }
    }, 1000);

    res.json({ success: true });
  } catch (error) {
    log.error(`Error embarcando andén: ${error.message}`);
    res.status(500).json({ error: 'Error al embarcar andén' });
  }
});

// ==================== ENDPOINTS DE ESCANEOS ====================

// POST /api/scan - Procesar escaneo
app.post('/api/scan', async (req, res) => {
  try {
    const { anden, ubicacion, numeroParte, destino, numeroCajas, codigoPallet } = req.body;
    
    log.info(`Escaneo recibido: ${JSON.stringify(req.body)}`);

    // Obtener andén destino
    let andenId = parseInt(anden) || 1;
    const andenResult = await db.query(`
      SELECT * FROM Andenes WHERE Id = @id
    `, { id: andenId });

    if (andenResult.recordset.length === 0) {
      // Si no existe, usar el primer andén
      const primerAnden = await db.query(`
        SELECT TOP 1 * FROM Andenes ORDER BY Id
      `);
      andenId = primerAnden.recordset[0]?.Id || 1;
    }

    const andenData = andenResult.recordset[0] || { Id: andenId };

    // Crear registro de pallet
    const palletId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    await db.query(`
      INSERT INTO Pallets (Id, Ubicacion, NumeroParte, CodigoPallet, FechaHora, AndeneId)
      VALUES (@id, @ubicacion, @numeroParte, @codigoPallet, GETDATE(), @andenId)
    `, {
      id: palletId,
      ubicacion: ubicacion || `A${andenId}`,
      numeroParte: numeroParte || codigoPallet || '-',
      codigoPallet: codigoPallet || '-',
      andenId
    });

    // Registrar escaneo
    await db.query(`
      INSERT INTO Escaneos (AndeneId, CodigoPallet, Ubicacion, FechaHora)
      VALUES (@andenId, @codigoPallet, @ubicacion, GETDATE())
    `, {
      andenId,
      codigoPallet: codigoPallet || '-',
      ubicacion: ubicacion || `A${andenId}`
    });

    // Actualizar estado del andén
    const escaneos = await db.query(`
      SELECT COUNT(*) as total FROM Escaneos 
      WHERE AndeneId = @andenId AND FechaHora >= DATEADD(hour, -1, GETDATE())
    `, { andenId });

    const totalEscaneos = escaneos.recordset[0]?.total || 0;
    let nuevoStatus = 'En espera';

    if (totalEscaneos >= (andenData.LimiteCamion || 50)) {
      nuevoStatus = 'Cargando';
    } else if (totalEscaneos > 0) {
      nuevoStatus = 'En espera';
    }

    // Actualizar andén
    await db.query(`
      UPDATE Andenes 
      SET Status = @status,
          UltimaFechaEscaneo = GETDATE(),
          NumeroCajas = @numeroCajas
      WHERE Id = @andenId
    `, {
      andenId,
      status: nuevoStatus,
      numeroCajas: totalEscaneos
    });

    // Registrar cambio de estado
    await db.query(`
      INSERT INTO Historial (AndeneId, Tipo, Codigo, Usuario, Info, FechaHora)
      VALUES (@andenId, 'status', @codigo, 'Sistema', 'Cambio de status por escaneo', GETDATE())
    `, {
      andenId,
      codigo: nuevoStatus
    });

    res.json({ success: true });
  } catch (error) {
    log.error(`Error procesando escaneo: ${error.message}`);
    res.status(500).json({ error: 'Error al procesar escaneo' });
  }
});

// POST /api/tcp - Endpoint para escaneos TCP
app.post('/api/tcp', async (req, res) => {
  try {
    let body = req.body;
    let json = null;

    // Procesar datos según el formato recibido
    if (typeof body === 'string') {
      json = { codigoPallet: body.trim(), ubicacion: 'A1' };
    } else {
      json = body;
    }

    // Crear objeto pallet unificado
    const palletData = {
      ubicacion: json.ubicacion || 'A1',
      codigoPallet: json.codigoPallet || json.codigo || json.barcode || '-',
      numeroParte: json.numeroParte || json.codigoPallet || json.codigo || json.barcode || '-'
    };

    // Procesar como escaneo normal
    await this.processEscaneo({
      anden: 1, // Andén por defecto para TCP
      ...palletData
    });

    log.info(`Escaneo TCP procesado: ${palletData.codigoPallet}`);
    res.json({ success: true });
  } catch (error) {
    log.error(`Error procesando escaneo TCP: ${error.message}`);
    res.status(500).json({ error: 'Error al procesar escaneo TCP' });
  }
});

// ==================== ENDPOINTS DE HISTORIAL ====================

// GET /api/historial - Historial global
app.get('/api/historial', async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await db.query(`
      SELECT TOP (@limit) *
      FROM (
        SELECT *, ROW_NUMBER() OVER (ORDER BY FechaHora DESC) as rn
        FROM Historial
      ) AS h
      WHERE rn > @offset
      ORDER BY FechaHora DESC
    `, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json(result.recordset);
  } catch (error) {
    log.error(`Error obteniendo historial: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// GET /api/andenes/:id/historial - Historial de ciclos por andén
app.get('/api/andenes/:id/historial', async (req, res) => {
  try {
    const andenId = parseInt(req.params.id);
    
    const result = await db.query(`
      SELECT * FROM HistorialCiclos 
      WHERE AndeneId = @andenId 
      ORDER BY FechaHora DESC
    `, { andenId });

    res.json({ historial: result.recordset });
  } catch (error) {
    log.error(`Error obteniendo historial del andén: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener historial del andén' });
  }
});

// GET /api/escaneos - Historial de escaneos
app.get('/api/escaneos', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT AndeneId, CodigoPallet, Ubicacion, FechaHora
      FROM Escaneos
      ORDER BY FechaHora DESC
    `);

    // Agrupar por andén para mantener compatibilidad con frontend
    const historial = {};
    result.recordset.forEach(escaneo => {
      if (!historial[escaneo.AndeneId]) {
        historial[escaneo.AndeneId] = [];
      }
      historial[escaneo.AndeneId].push(escaneo);
    });

    res.json({ historial });
  } catch (error) {
    log.error(`Error obteniendo escaneos: ${error.message}`);
    res.status(500).json({ error: 'Error al obtener escaneos' });
  }
});

// ==================== BACKUPS Y COMPATIBILIDAD ====================

// Backup automático a JSON si está habilitado
async function backupToJson() {
  if (process.env.ENABLE_JSON_BACKUP === 'true') {
    try {
      const dataDir = process.env.DATA_DIR || './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Backup usuarios
      const usuarios = await db.query('SELECT * FROM Usuarios');
      fs.writeFileSync(
        path.join(dataDir, 'usuarios_backup.json'),
        JSON.stringify(usuarios.recordset, null, 2)
      );

      // Backup andenes
      const andenes = await db.query('SELECT * FROM Andenes');
      fs.writeFileSync(
        path.join(dataDir, 'andenes_backup.json'),
        JSON.stringify(andenes.recordset, null, 2)
      );

      log.info('Backup a JSON completado');
    } catch (error) {
      log.error(`Error en backup a JSON: ${error.message}`);
    }
  }
}

// Programar backup cada hora
if (process.env.NODE_ENV === 'production') {
  setInterval(backupToJson, 60 * 60 * 1000);
}

// ==================== INICIALIZACIÓN ====================

async function inicializarServidor() {
  try {
    // Probar conexión a base de datos
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      throw new Error('No se pudo conectar a la base de datos');
    }

    log.info('Conexión a base de datos establecida');

    // Verificar que existan los andenes básicos
    const andenes = await db.query('SELECT COUNT(*) as total FROM Andenes');
    if (andenes.recordset[0].total === 0) {
      log.info('Inicializando andenes básicos...');
      // Los andenes se crean automáticamente por el schema SQL
    }

    // Inicializar backup inicial
    await backupToJson();

    // Iniciar servidor
    app.listen(PORT, () => {
      log.info(`Servidor Culligan Backend iniciado en puerto ${PORT}`);
      log.info(`Entorno: ${process.env.NODE_ENV || 'development'}`);
      log.info(`Health check disponible en: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    log.error(`Error iniciando servidor: ${error.message}`);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on('SIGINT', async () => {
  log.info('Cerrando servidor...');
  await db.closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log.info('Cerrando servidor...');
  await db.closeConnection();
  process.exit(0);
});

// Inicializar aplicación
inicializarServidor();