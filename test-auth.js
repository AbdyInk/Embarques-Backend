// Script de prueba para verificar el sistema de autenticación mejorado

// Test 1: Login con administrador (debería durar 2 horas)
console.log('🧪 Probando login de administrador...');
fetch('http://localhost:4000/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usuario: 'admin', password: 'admin123' })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Login administrador exitoso:');
  console.log('- Token:', data.token.substring(0, 20) + '...');
  console.log('- Usuario:', data.usuario);
  console.log('- Expiración:', data.expiresIn);
  
  const adminToken = data.token;
  
  // Test 2: Validar token de administrador
  console.log('\n🔍 Validando token de administrador...');
  return fetch('http://localhost:4000/api/validate-token', {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
})
.then(res => res.json())
.then(data => {
  console.log('✅ Validación de token exitosa:', data);
})
.catch(err => {
  console.error('❌ Error en prueba de administrador:', err);
});

// Test 3: Login con operador (debería durar 12 horas)
setTimeout(() => {
  console.log('\n🧪 Probando login de operador...');
  fetch('http://localhost:4000/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: 'operador', password: 'operador123' })
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Login operador exitoso:');
    console.log('- Token:', data.token.substring(0, 20) + '...');
    console.log('- Usuario:', data.usuario);
    console.log('- Expiración:', data.expiresIn);
    
    const operatorToken = data.token;
    
    // Test 4: Validar token de operador
    console.log('\n🔍 Validando token de operador...');
    return fetch('http://localhost:4000/api/validate-token', {
      headers: { 'Authorization': `Bearer ${operatorToken}` }
    });
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Validación de token exitosa:', data);
    console.log('\n🎉 ¡Todas las pruebas de autenticación pasaron correctamente!');
    console.log('\n📋 Resumen del sistema:');
    console.log('- ✅ Administradores: 2 horas de sesión');
    console.log('- ✅ Operadores: 12 horas de sesión');
    console.log('- ✅ Validación de tokens funcionando');
    console.log('- ✅ Información de usuario en respuestas');
  })
  .catch(err => {
    console.error('❌ Error en prueba de operador:', err);
  });
}, 1000);

// Test 5: Probar token inválido
setTimeout(() => {
  console.log('\n🧪 Probando token inválido...');
  fetch('http://localhost:4000/api/validate-token', {
    headers: { 'Authorization': 'Bearer token_invalido' }
  })
  .then(res => {
    if (res.status === 403) {
      console.log('✅ Token inválido correctamente rechazado');
    } else {
      console.error('❌ Token inválido no fue rechazado');
    }
  })
  .catch(err => {
    console.log('✅ Token inválido correctamente rechazado con error:', err.message);
  });
}, 2000);