const sql = require('mssql');
require('dotenv').config();

/**
 * Configuración de conexión a SQL Server
 */
const config = {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'CulliganEmbarques',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true' || false,
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' || true,
        enableArithAbort: true,
        instanceName: process.env.DB_INSTANCE || undefined,
    },
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 30000,
    requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT) || 30000,
    pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 2,
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        idleTimeoutMillis: 30000,
    },
};

/**
 * Pool de conexiones global
 */
let pool = null;

/**
 * Inicializar conexión a la base de datos
 */
async function inicializarDB() {
    try {
        if (pool) {
            return pool;
        }

        console.log('🔌 Conectando a SQL Server...');
        console.log(`   Servidor: ${config.server}:${config.port}`);
        console.log(`   Base de datos: ${config.database}`);
        
        pool = await sql.connect(config);
        
        console.log('✅ Conexión exitosa a SQL Server');
        
        // Verificar que las tablas principales existan
        await verificarEsquema();
        
        return pool;
    } catch (error) {
        console.error('❌ Error al conectar con SQL Server:', error.message);
        console.error('   Verificar configuración de base de datos en .env');
        throw error;
    }
}

/**
 * Verificar que el esquema de base de datos existe
 */
async function verificarEsquema() {
    try {
        const request = pool.request();
        
        // Verificar tabla Usuarios
        const usuariosExiste = await request.query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Usuarios'
        `);
        
        if (usuariosExiste.recordset[0].count === 0) {
            console.warn('⚠️  La tabla Usuarios no existe. Ejecutar schema.sql');
        }
        
        // Verificar tabla Andenes
        const andenesExiste = await request.query(`
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'Andenes'
        `);
        
        if (andenesExiste.recordset[0].count === 0) {
            console.warn('⚠️  La tabla Andenes no existe. Ejecutar schema.sql');
        }
        
        console.log('✅ Esquema de base de datos verificado');
    } catch (error) {
        console.warn('⚠️  No se pudo verificar el esquema:', error.message);
    }
}

/**
 * Obtener el pool de conexiones
 */
function obtenerPool() {
    if (!pool) {
        throw new Error('Base de datos no inicializada. Llamar inicializarDB() primero.');
    }
    return pool;
}

/**
 * Cerrar conexión a la base de datos
 */
async function cerrarDB() {
    try {
        if (pool) {
            await pool.close();
            pool = null;
            console.log('🔌 Conexión a SQL Server cerrada');
        }
    } catch (error) {
        console.error('❌ Error al cerrar conexión:', error);
    }
}

/**
 * Ejecutar consulta con manejo de errores
 */
async function ejecutarConsulta(query, parametros = {}) {
    try {
        const request = pool.request();
        
        // Agregar parámetros
        Object.keys(parametros).forEach(key => {
            request.input(key, parametros[key]);
        });
        
        const resultado = await request.query(query);
        return resultado;
    } catch (error) {
        console.error('❌ Error ejecutando consulta:', error.message);
        console.error('   Query:', query);
        throw error;
    }
}

/**
 * Ejecutar procedimiento almacenado
 */
async function ejecutarProcedimiento(nombreProcedimiento, parametros = {}) {
    try {
        const request = pool.request();
        
        // Agregar parámetros
        Object.keys(parametros).forEach(key => {
            request.input(key, parametros[key]);
        });
        
        const resultado = await request.execute(nombreProcedimiento);
        return resultado;
    } catch (error) {
        console.error('❌ Error ejecutando procedimiento:', error.message);
        console.error('   Procedimiento:', nombreProcedimiento);
        throw error;
    }
}

/**
 * Health check de la base de datos
 */
async function healthCheck() {
    try {
        const resultado = await ejecutarConsulta('SELECT 1 as status, GETDATE() as timestamp');
        return {
            status: 'healthy',
            timestamp: resultado.recordset[0].timestamp,
            connected: true
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            connected: false
        };
    }
}

/**
 * Limpiar recursos en caso de cierre de aplicación
 */
process.on('SIGINT', async () => {
    console.log('\n🛑 Cerrando aplicación...');
    await cerrarDB();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Señal SIGTERM recibida...');
    await cerrarDB();
    process.exit(0);
});

module.exports = {
    inicializarDB,
    obtenerPool,
    cerrarDB,
    ejecutarConsulta,
    ejecutarProcedimiento,
    healthCheck,
    sql // Exportar para tipos de datos
};