# 🚀 INSTRUCCIONES PARA EJECUTAR PRUEBAS AUTOMÁTICAS

## ⚠️ PREREQUISITOS

Para que las pruebas funcionen, necesitas:

1. **Docker corriendo** (PostgreSQL, Redis, Qdrant)
2. **Backend corriendo** en el puerto 3001
3. **Permisos de Docker** o usar `sudo`

---

## 🔧 CONFIGURACIÓN INICIAL (Solo una vez)

### 1. Agregar usuario al grupo Docker

```bash
sudo usermod -aG docker $USER
```

**IMPORTANTE:** Cierra sesión y vuelve a iniciar sesión para que los cambios surtan efecto.

### 2. Verificar Docker

```bash
docker ps
```

Si funciona sin `sudo`, estás listo. Si no, usa `sudo docker ps`.

---

## 🚀 EJECUTAR PRUEBAS AUTOMÁTICAS

### Opción A: Script Automático Completo

```bash
cd /home/bmrx/Desktop/SYSTINF
./ejecutar-pruebas-auto.sh
```

Este script:
- ✅ Verifica Docker
- ✅ Inicia servicios Docker si no están corriendo
- ✅ Inicia el backend
- ✅ Espera a que todo esté listo
- ✅ Ejecuta las pruebas automáticamente

### Opción B: Manual (Paso a Paso)

**Terminal 1: Iniciar Docker**
```bash
cd /home/bmrx/Desktop/SYSTINF
docker-compose up -d postgres redis qdrant
# O con sudo si no tienes permisos:
# sudo docker-compose up -d postgres redis qdrant
```

**Terminal 2: Iniciar Backend**
```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev:nocheck
```

Espera a ver:
```
🔓 CORS: Allowing all origins in development mode
✅ Database connected
🚀 SYST Backend running on: http://localhost:3001/api/v1
```

**Terminal 3: Ejecutar Pruebas**
```bash
cd /home/bmrx/Desktop/SYSTINF
./test-auth.sh
```

---

## 🧪 QUÉ PRUEBA EL SCRIPT

El script `test-auth.sh` ejecuta automáticamente:

1. ✅ **Registro de Usuario**
   - Crea un usuario nuevo con email único
   - Verifica que se reciba un token JWT
   - Verifica que se reciba la información del usuario

2. ✅ **Login con Credenciales Válidas**
   - Inicia sesión con el usuario creado
   - Verifica que se reciba un token JWT
   - Verifica que se reciba la información del usuario

3. ✅ **Login con Contraseña Incorrecta**
   - Intenta login con contraseña incorrecta
   - Verifica que se rechace correctamente (HTTP 401)

4. ✅ **Registro con Email Duplicado**
   - Intenta registrar un email que ya existe
   - Verifica que se rechace correctamente (HTTP 409)

---

## 📊 RESULTADO ESPERADO

```
🧪 PRUEBA DE AUTENTICACIÓN - SYST
==========================================

Verificando backend...
✅ Backend está corriendo

📝 Probando registro de usuario...
✅ Registro exitoso!
✅ Prueba 1: Registro - PASÓ

🔐 Probando login...
✅ Login exitoso!
✅ Prueba 2: Login - PASÓ

🔐 Probando login con contraseña incorrecta...
✅ Correctamente rechazado (HTTP 401)
✅ Prueba 3: Login con contraseña incorrecta - PASÓ

📝 Probando registro con email duplicado...
✅ Correctamente rechazado (HTTP 409)
✅ Prueba 4: Registro con email duplicado - PASÓ

==========================================
✅ TODAS LAS PRUEBAS COMPLETADAS
==========================================
```

---

## ❌ SI HAY ERRORES

### Error: "Docker no está corriendo"

**Solución:**
```bash
# Iniciar Docker
sudo systemctl start docker

# Verificar
sudo docker ps
```

### Error: "Permission denied" con Docker

**Solución:**
```bash
# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# CERRAR SESIÓN Y VOLVER A INICIAR SESIÓN
# Luego verificar:
docker ps
```

### Error: "Backend no está corriendo"

**Solución:**
```bash
# Verificar si el puerto está ocupado
lsof -i :3001

# Si hay un proceso, detenerlo:
kill -9 <PID>

# Iniciar backend
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev:nocheck
```

### Error: "Database connection failed"

**Solución:**
```bash
# Verificar que Docker esté corriendo
docker ps | grep syst

# Si no hay contenedores, iniciarlos:
docker-compose up -d postgres redis qdrant

# Esperar unos segundos y reiniciar backend
```

### Error: "CORS request did not succeed"

**Solución:**
- El backend no está corriendo o no está escuchando en el puerto 3001
- Verifica los logs del backend
- Asegúrate de que veas el mensaje: "🚀 SYST Backend running on: http://localhost:3001/api/v1"

---

## 🔍 VERIFICACIÓN RÁPIDA

Ejecuta estos comandos para verificar que todo está bien:

```bash
# 1. Verificar Docker
docker ps | grep syst
# Deberías ver: syst-postgres, syst-redis, syst-qdrant

# 2. Verificar Backend
curl http://localhost:3001/api/v1
# Debería responder (aunque sea un 404)

# 3. Verificar puerto
lsof -i :3001
# Debería mostrar el proceso del backend
```

---

## 📝 NOTAS

- El script crea un usuario de prueba con email único (usando timestamp)
- Las pruebas son independientes y se pueden ejecutar múltiples veces
- El backend debe estar corriendo antes de ejecutar las pruebas
- Si Docker no está disponible, el backend no podrá conectarse a la base de datos

---

**Para ejecutar las pruebas automáticamente:**

```bash
cd /home/bmrx/Desktop/SYSTINF
./ejecutar-pruebas-auto.sh
```

O manualmente siguiendo los pasos en "Opción B: Manual (Paso a Paso)".



























