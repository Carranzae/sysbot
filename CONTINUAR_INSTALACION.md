# ✅ DOCKER INSTALADO - CONTINUAR INSTALACIÓN

## 🎉 ¡Docker se instaló correctamente!

Ahora necesitas aplicar los permisos y continuar con el setup.

---

## 🔧 PASO 1: APLICAR PERMISOS (YA EJECUTADO)

```bash
sudo usermod -aG docker $USER
```

✅ Este comando ya se ejecutó.

---

## 🔄 PASO 2: APLICAR CAMBIOS DE PERMISOS

Tienes 2 opciones:

### Opción A: Cerrar sesión y volver a entrar (Recomendado)
1. Cierra tu sesión actual
2. Vuelve a iniciar sesión
3. Los permisos se aplicarán automáticamente

### Opción B: Usar newgrp (Rápido pero temporal)
```bash
newgrp docker
```

Luego continúa con los siguientes pasos.

---

## 🚀 PASO 3: INICIAR SERVICIOS DOCKER

```bash
cd /home/bmrx/Desktop/SYSTINF
sudo docker-compose up -d postgres redis qdrant
```

Espera a que descargue las imágenes (primera vez toma 2-3 minutos).

Verifica que estén corriendo:
```bash
sudo docker ps
```

Deberías ver:
- ✅ syst-postgres
- ✅ syst-redis  
- ✅ syst-qdrant

---

## 📦 PASO 4: CONFIGURAR BASE DE DATOS

```bash
cd /home/bmrx/Desktop/SYSTINF/packages/database
pnpm prisma migrate dev --name init
```

---

## 🖥️ PASO 5: INICIAR BACKEND

Abre una **NUEVA TERMINAL** y ejecuta:

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev
```

Espera a ver:
```
[Nest] Application successfully started
[Nest] Listening on http://localhost:3001
```

**¡NO CIERRES ESTA TERMINAL!**

---

## 🌐 PASO 6: INICIAR FRONTEND

Abre **OTRA TERMINAL** y ejecuta:

```bash
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev
```

Espera a ver:
```
▲ Next.js 14.0.4
- Local:        http://localhost:3000
```

**¡NO CIERRES ESTA TERMINAL!**

---

## 🎯 PASO 7: ACCEDER AL SISTEMA

1. Abre tu navegador
2. Ve a: **http://localhost:3000**
3. Click en **"Regístrate aquí"**
4. Completa el formulario:
   - Nombre: `Admin`
   - Apellido: `Test`
   - Email: `admin@test.com`
   - Contraseña: `admin123`
5. Click en **"Crear Cuenta"**
6. ¡Listo! Estarás en el dashboard

---

## 📝 RESUMEN DE COMANDOS

```bash
# 1. Aplicar permisos (si no cerraste sesión)
newgrp docker

# 2. Iniciar Docker services
cd /home/bmrx/Desktop/SYSTINF
sudo docker-compose up -d postgres redis qdrant

# 3. Verificar
sudo docker ps

# 4. Configurar BD
cd packages/database
pnpm prisma migrate dev --name init

# 5. Backend (Terminal 1)
cd /home/bmrx/Desktop/SYSTINF/apps/backend
pnpm dev

# 6. Frontend (Terminal 2)
cd /home/bmrx/Desktop/SYSTINF/apps/frontend
pnpm dev

# 7. Acceder
# http://localhost:3000
```

---

## ⚠️ NOTA IMPORTANTE

El archivo `.env` ya fue creado automáticamente por el script con la configuración correcta.

---

## 🆘 SI ALGO FALLA

### Error de permisos con Docker
```bash
# Usar sudo temporalmente
sudo docker-compose up -d postgres redis qdrant
sudo docker ps
```

### Puerto ocupado
```bash
lsof -i :3000  # Frontend
lsof -i :3001  # Backend
kill -9 <PID>
```

---

**¡Continúa con el PASO 2!** 🚀
