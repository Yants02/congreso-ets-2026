# Manual de Instalación y Puesta en Marcha - Congreso ETS 2026

Este paquete contiene la plataforma completa del **1° Congreso de Educación Técnica Superior (Congreso ETS 2026)**, compuesta por:
1. **Base de Datos Relacional:** PostgreSQL (versión 14, 15, 16 o 17).
2. **Backend API BFF:** Node.js (v20+) / Express / TypeScript con cifrado criptográfico QR (AES-256-CBC).
3. **Frontend Web & PWA:** Next.js 16 / React 19 con diseño institucional, panel de administración y PWA de acreditación offline.

---

## 📋 Requisitos del Servidor (Webserver)

- **Sistema Operativo:** Linux (Ubuntu 22.04/24.04, Debian 12, RHEL, etc.) o Windows Server.
- **Node.js:** Versión 20.x o superior LTS.
- **npm:** Versión 10.x o superior.
- **PostgreSQL:** Versión 14 o superior instalado y activo.

---

## 🗄️ PASO 1: Creación y Carga de la Base de Datos (PostgreSQL)

En la carpeta `database/` se incluyen los scripts SQL:
- `01_backup_completo_con_datos.sql`: **(RECOMENDADO)** Crea la estructura completa (30 tablas, índices, triggers y funciones de integridad) e incluye los datos iniciales, usuarios y operadores precargados.
- `02_schema_vacio.sql`: Solo la estructura limpia de tablas.
- `03_seed_inicial.sql`: Carga de datos base.

### Instrucciones de creación:

1. Ingrese a la consola de PostgreSQL (`psql`):
   ```bash
   sudo -u postgres psql
   ```

2. Cree la base de datos y el usuario de la aplicación:
   ```sql
   CREATE DATABASE congreso_ets2026;
   CREATE USER congreso_app WITH ENCRYPTED PASSWORD 'V-129057-t';
   GRANT ALL PRIVILEGES ON DATABASE congreso_ets2026 TO congreso_app;
   \c congreso_ets2026
   GRANT ALL ON SCHEMA public TO congreso_app;
   \q
   ```

3. Importe el backup completo con datos:
   ```bash
   psql -U congreso_app -d congreso_ets2026 -h localhost -f database/01_backup_completo_con_datos.sql
   ```
   *(Si se conecta como usuario `postgres`: `psql -U postgres -d congreso_ets2026 -f database/01_backup_completo_con_datos.sql`)*

---

## ⚙️ PASO 2: Configuración del Backend

1. Ingrese a la carpeta `backend`:
   ```bash
   cd backend
   ```

2. Cree el archivo de entorno `.env` a partir del ejemplo:
   ```bash
   cp .env.example .env
   ```

3. Edite `.env` con los datos de su base de datos y parámetros SMTP de correo:
   ```ini
   DATABASE_URL="postgresql://congreso_app:V-129057-t@localhost:5432/congreso_ets2026"
   ENCRYPTION_KEY="e4b7c1a89f2d3e4b5a6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"
   PORT=4000
   NODE_ENV="production"
   CORS_ORIGIN="http://localhost:3000"
   ```

4. Instale dependencias y compile el backend:
   ```bash
   npm install
   npm run build
   ```

---

## 🎨 PASO 3: Configuración del Frontend

1. Ingrese a la carpeta `frontend`:
   ```bash
   cd ../frontend
   ```

2. Cree el archivo `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

3. Instale dependencias y compile el Frontend en producción:
   ```bash
   npm install
   npm run build
   ```

---

## 🚀 PASO 4: Puesta en Marcha de los Servicios

### Opción A: Ejecución mediante scripts incluidos (Linux)
Desde la raíz del proyecto:
```bash
./Iniciar_Congreso.sh
```
- Para verificar estado o reiniciar: `./Reiniciar_Congreso.sh`
- Para detener: `./Detener_Congreso.sh`

### Opción B: Ejecución con Gestor de Procesos PM2 (Recomendado para servidores)
```bash
# Iniciar Backend
cd backend
pm2 start dist/server.js --name "congreso-backend"

# Iniciar Frontend
cd ../frontend
pm2 start npm --name "congreso-frontend" -- start
```

### Opción C: Despliegue con Docker Compose
Si el servidor cuenta con Docker y Docker Compose:
```bash
docker compose up -d --build
```

---

## 🔑 Credenciales de Acceso Precargadas

| Perfil / Rol | Email Institucional | Contraseña | Destino |
| :--- | :--- | :--- | :--- |
| **Superadmin General** | `superadmin.congreso@bue.edu.ar` | `SuperAdmin2026!` | Panel `/admin` (Control total y CRUDs) |
| **Administrador General** | `admin@ifts04.edu.ar` | `AdminCongreso2026!` | Panel `/admin` (Actividades y Acreditaciones) |
| **Operador Puerta 1** | `operador1.puerta@bue.edu.ar` | `Operador2026!` | PWA `/pwa-operador` (Puerta Principal) |
| **Operador Puerta 2** | `operador2.lateral@bue.edu.ar` | `Operador2026!` | PWA `/pwa-operador` (Puerta Lateral) |
| **Verificador Pergaminos** | `verificador.dets@bue.edu.ar` | `Verificador2026!` | Homologación de Expositores |

---

## 🌐 URLs de la Plataforma
- **Portal Público:** `http://localhost:3000`
- **Panel Administrativo:** `http://localhost:3000/admin`
- **PWA Operador en Sede:** `http://localhost:3000/pwa-operador`
- **API Health Check:** `http://localhost:4000/health`
