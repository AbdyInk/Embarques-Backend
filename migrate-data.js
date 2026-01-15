const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// Cargar configuración
require('dotenv').config();

// Configuración de base de datos
const dbConfig = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'CulliganEmbarques',
  user: process.env.DB_USER || 'culligan_user',
  password: process.env.DB_PASSWORD || 'cambiar_password',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    enableArithAbort: true,
    requestTimeout: 30000,
    connectionTimeout: 30000
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

class DataMigrator {
  constructor() {
    this.pool = null;
  }

  async connect() {
    try {
      this.pool = await sql.connect(dbConfig);
      console.log('✅ Conectado a SQL Server');
      return true;
    } catch (error) {
      console.error('❌ Error conectando a BD:', error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.close();
      console.log('🔌 Desconectado de SQL Server');
    }
  }

  // Migrar usuarios desde usuarios.json
  async migrateUsers() {
    console.log('👥 Migrando usuarios...');
    
    const usuariosPath = './usuarios.json';
    if (!fs.existsSync(usuariosPath)) {
      console.log('⚠️  No se encontró usuarios.json');
      return;
    }

    try {
      const usuarios = JSON.parse(fs.readFileSync(usuariosPath, 'utf8'));
      const request = this.pool.request();
      
      let migrados = 0;
      for (const usuario of usuarios) {
        try {
          // Verificar si ya existe
          const existeResult = await request
            .input('usuario', sql.VarChar(50), usuario.usuario)
            .query('SELECT Id FROM Usuarios WHERE Usuario = @usuario');

          if (existeResult.recordset.length > 0) {
            console.log(`⏭️  Usuario ${usuario.usuario} ya existe, omitiendo...`);
            continue;
          }

          // Insertar usuario
          await request
            .input('id', sql.Int, usuario.id)
            .input('usuario', sql.VarChar(50), usuario.usuario)
            .input('password', sql.VarChar(255), usuario.password)
            .input('grupo', sql.VarChar(20), usuario.grupo)
            .input('activo', sql.Bit, usuario.activo || true)
            .input('fechaCreacion', sql.DateTime, new Date(usuario.fechaCreacion))
            .query(`
              INSERT INTO Usuarios (Id, Usuario, Password, Grupo, Activo, FechaCreacion)
              VALUES (@id, @usuario, @password, @grupo, @activo, @fechaCreacion)
            `);

          console.log(`✅ Usuario migrado: ${usuario.usuario}`);
          migrados++;
        } catch (error) {
          console.error(`❌ Error migrando usuario ${usuario.usuario}:`, error.message);
        }
      }

      console.log(`📊 Total usuarios migrados: ${migrados}/${usuarios.length}`);
    } catch (error) {
      console.error('❌ Error en migración de usuarios:', error.message);
    }
  }

  // Migrar historial de ciclos desde andenesHistorial.json
  async migrateHistorialCiclos() {
    console.log('📜 Migrando historial de ciclos...');
    
    const historialPath = './andenesHistorial.json';
    if (!fs.existsSync(historialPath)) {
      console.log('⚠️  No se encontró andenesHistorial.json');
      return;
    }

    try {
      const historial = JSON.parse(fs.readFileSync(historialPath, 'utf8'));
      const request = this.pool.request();
      
      let migrados = 0;
      for (const ciclo of historial) {
        try {
          await request
            .input('andenId', sql.Int, ciclo.id)
            .input('status', sql.VarChar(20), ciclo.status || 'Embarcado')
            .input('limiteCamion', sql.Int, ciclo.limiteCamion || 0)
            .input('destino', sql.VarChar(100), ciclo.destino || '')
            .input('numeroCajas', sql.Int, ciclo.numeroCajas || 0)
            .input('ultimaFechaEscaneo', sql.DateTime, ciclo.ultimaFechaEscaneo ? new Date(ciclo.ultimaFechaEscaneo) : null)
            .input('horaInicioEscaneo', sql.DateTime, ciclo.horaInicioEscaneo ? new Date(ciclo.horaInicioEscaneo) : null)
            .input('horaCompletado', sql.DateTime, ciclo.horaCompletado ? new Date(ciclo.horaCompletado) : null)
            .input('horaDocumentado', sql.DateTime, ciclo.horaDocumentado ? new Date(ciclo.horaDocumentado) : null)
            .input('horaEmbarcado', sql.DateTime, ciclo.horaEmbarcado ? new Date(ciclo.horaEmbarcado) : null)
            .input('usuarioDocumenta', sql.VarChar(50), ciclo.usuarioDocumenta)
            .input('usuarioEmbarca', sql.VarChar(50), ciclo.usuarioEmbarca)
            .input('fechaHora', sql.DateTime, new Date())
            .query(`
              INSERT INTO HistorialCiclos (
                AndeneId, Status, LimiteCamion, Destino, NumeroCajas,
                UltimaFechaEscaneo, HoraInicioEscaneo, HoraCompletado,
                HoraDocumentado, HoraEmbarcado, UsuarioDocumenta, UsuarioEmbarca,
                FechaHora
              )
              VALUES (
                @andenId, @status, @limiteCamion, @destino, @numeroCajas,
                @ultimaFechaEscaneo, @horaInicioEscaneo, @horaCompletado,
                @horaDocumentado, @horaEmbarcado, @usuarioDocumenta, @usuarioEmbarca,
                @fechaHora
              )
            `);

          migrados++;
        } catch (error) {
          console.error(`❌ Error migrando ciclo del andén ${ciclo.id}:`, error.message);
        }
      }

      console.log(`📊 Total ciclos migrados: ${migrados}/${historial.length}`);
    } catch (error) {
      console.error('❌ Error en migración de historial de ciclos:', error.message);
    }
  }

  // Migrar datos adicionales si existen archivos de backup
  async migrateBackupData() {
    console.log('💾 Verificando archivos de backup...');
    
    // Buscar directorios de backup
    const backupDirs = fs.readdirSync('.')
      .filter(dir => dir.startsWith('backup_') && fs.statSync(dir).isDirectory());

    for (const backupDir of backupDirs) {
      console.log(`📁 Revisando ${backupDir}...`);
      
      // Migrar usuarios de backup si existen
      const usuariosBackupPath = path.join(backupDir, 'usuarios.json');
      if (fs.existsSync(usuariosBackupPath)) {
        console.log('👥 Encontrado usuarios.json en backup');
        const usuarios = JSON.parse(fs.readFileSync(usuariosBackupPath, 'utf8'));
        await this.migrateUsersFromArray(usuarios);
      }

      // Migrar historial de backup si existe
      const historialBackupPath = path.join(backupDir, 'andenesHistorial.json');
      if (fs.existsSync(historialBackupPath)) {
        console.log('📜 Encontrado andenesHistorial.json en backup');
        const historial = JSON.parse(fs.readFileSync(historialBackupPath, 'utf8'));
        await this.migrateHistorialFromArray(historial);
      }
    }
  }

  async migrateUsersFromArray(usuarios) {
    const request = this.pool.request();
    let migrados = 0;
    
    for (const usuario of usuarios) {
      try {
        // Verificar si ya existe
        const existeResult = await request
          .input('usuario', sql.VarChar(50), usuario.usuario)
          .query('SELECT Id FROM Usuarios WHERE Usuario = @usuario');

        if (existeResult.recordset.length > 0) continue;

        await request
          .input('id', sql.Int, usuario.id)
          .input('usuario', sql.VarChar(50), usuario.usuario)
          .input('password', sql.VarChar(255), usuario.password)
          .input('grupo', sql.VarChar(20), usuario.grupo)
          .input('activo', sql.Bit, usuario.activo || true)
          .input('fechaCreacion', sql.DateTime, new Date(usuario.fechaCreacion))
          .query(`
            INSERT INTO Usuarios (Id, Usuario, Password, Grupo, Activo, FechaCreacion)
            VALUES (@id, @usuario, @password, @grupo, @activo, @fechaCreacion)
          `);

        migrados++;
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    
    if (migrados > 0) {
      console.log(`✅ ${migrados} usuarios migrados desde backup`);
    }
  }

  async migrateHistorialFromArray(historial) {
    const request = this.pool.request();
    let migrados = 0;
    
    for (const ciclo of historial) {
      try {
        await request
          .input('andenId', sql.Int, ciclo.id)
          .input('status', sql.VarChar(20), ciclo.status || 'Embarcado')
          .input('limiteCamion', sql.Int, ciclo.limiteCamion || 0)
          .input('destino', sql.VarChar(100), ciclo.destino || '')
          .input('numeroCajas', sql.Int, ciclo.numeroCajas || 0)
          .input('ultimaFechaEscaneo', sql.DateTime, ciclo.ultimaFechaEscaneo ? new Date(ciclo.ultimaFechaEscaneo) : null)
          .input('horaInicioEscaneo', sql.DateTime, ciclo.horaInicioEscaneo ? new Date(ciclo.horaInicioEscaneo) : null)
          .input('horaCompletado', sql.DateTime, ciclo.horaCompletado ? new Date(ciclo.horaCompletado) : null)
          .input('horaDocumentado', sql.DateTime, ciclo.horaDocumentado ? new Date(ciclo.horaDocumentado) : null)
          .input('horaEmbarcado', sql.DateTime, ciclo.horaEmbarcado ? new Date(ciclo.horaEmbarcado) : null)
          .input('usuarioDocumenta', sql.VarChar(50), ciclo.usuarioDocumenta)
          .input('usuarioEmbarca', sql.VarChar(50), ciclo.usuarioEmbarca)
          .input('fechaHora', sql.DateTime, new Date())
          .query(`
            INSERT INTO HistorialCiclos (
              AndeneId, Status, LimiteCamion, Destino, NumeroCajas,
              UltimaFechaEscaneo, HoraInicioEscaneo, HoraCompletado,
              HoraDocumentado, HoraEmbarcado, UsuarioDocumenta, UsuarioEmbarca,
              FechaHora
            )
            VALUES (
              @andenId, @status, @limiteCamion, @destino, @numeroCajas,
              @ultimaFechaEscaneo, @horaInicioEscaneo, @horaCompletado,
              @horaDocumentado, @horaEmbarcado, @usuarioDocumenta, @usuarioEmbarca,
              @fechaHora
            )
          `);

        migrados++;
      } catch (error) {
        console.error(`❌ Error: ${error.message}`);
      }
    }
    
    if (migrados > 0) {
      console.log(`✅ ${migrados} ciclos migrados desde backup`);
    }
  }

  // Verificar migración
  async verifyMigration() {
    console.log('🔍 Verificando migración...');
    
    try {
      const request = this.pool.request();
      
      // Contar usuarios
      const usuarios = await request.query('SELECT COUNT(*) as total FROM Usuarios');
      console.log(`👥 Usuarios en BD: ${usuarios.recordset[0].total}`);
      
      // Contar andenes
      const andenes = await request.query('SELECT COUNT(*) as total FROM Andenes');
      console.log(`🚛 Andenes en BD: ${andenes.recordset[0].total}`);
      
      // Contar historial de ciclos
      const historialCiclos = await request.query('SELECT COUNT(*) as total FROM HistorialCiclos');
      console.log(`📜 Ciclos históricos en BD: ${historialCiclos.recordset[0].total}`);
      
      // Contar escaneos
      const escaneos = await request.query('SELECT COUNT(*) as total FROM Escaneos');
      console.log(`📊 Escaneos en BD: ${escaneos.recordset[0].total}`);
      
      // Mostrar usuarios migrados
      const usuariosList = await request.query('SELECT Usuario, Grupo FROM Usuarios ORDER BY Id');
      console.log('\n👥 Usuarios migrados:');
      usuariosList.recordset.forEach(u => {
        console.log(`   - ${u.Usuario} (${u.Grupo})`);
      });
      
    } catch (error) {
      console.error('❌ Error verificando migración:', error.message);
    }
  }

  // Ejecutar migración completa
  async migrate() {
    console.log('🚀 Iniciando migración de datos...\n');
    
    const connected = await this.connect();
    if (!connected) {
      console.error('❌ No se pudo conectar a la base de datos');
      return;
    }

    try {
      // Migrar en orden
      await this.migrateUsers();
      await this.migrateHistorialCiclos();
      await this.migrateBackupData();
      
      // Verificar resultados
      await this.verifyMigration();
      
      console.log('\n🎉 ¡Migración completada exitosamente!');
      
    } catch (error) {
      console.error('❌ Error durante la migración:', error.message);
    } finally {
      await this.disconnect();
    }
  }
}

// Ejecutar migración si se llama directamente
if (require.main === module) {
  console.log('📊 MIGRADOR DE DATOS CULLIGAN EMBARQUES');
  console.log('=====================================\n');
  
  const migrator = new DataMigrator();
  
  migrator.migrate().then(() => {
    console.log('\n✨ Proceso de migración finalizado.');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Error fatal en migración:', error.message);
    process.exit(1);
  });
}

module.exports = DataMigrator;