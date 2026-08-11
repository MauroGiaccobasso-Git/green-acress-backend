# Green Acres — Backend

Backend de **Green Acres**, una plataforma web integral para la gestión de un club cannábico en Uruguay.

El sistema fue desarrollado como **Proyecto Integrador de la carrera Analista en Tecnologías de la Información de Universidad ORT Uruguay durante 2026**, abordando el ciclo completo de construcción de software: análisis funcional, diseño, desarrollo, modelado de datos, seguridad, testing, documentación y despliegue en la nube.

Este repositorio contiene la API REST y la lógica de negocio de la plataforma.

## Estado del proyecto

**Proyecto finalizado y desplegado.**

La solución fue implementada y validada tanto en entorno local como en infraestructura AWS.

Infraestructura utilizada para el despliegue:

- Amazon EC2 para la ejecución de la aplicación.
- Amazon RDS con PostgreSQL.
- Amazon S3 para almacenamiento de imágenes de productos.
- Nginx como reverse proxy.
- Variables de entorno para configuración y secretos.

> El entorno cloud corresponde al despliegue académico del proyecto y puede no encontrarse disponible permanentemente.

---

## Tecnologías principales

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- JavaScript ES Modules
- JWT
- bcrypt
- TOTP / MFA
- Nodemailer
- node-cron
- Multer
- AWS SDK for JavaScript
- Amazon EC2
- Amazon RDS
- Amazon S3
- Git / GitHub

---

## Arquitectura

El backend aplica una separación de responsabilidades orientada a mantener la lógica de negocio desacoplada de HTTP y de la persistencia.

```text
Routes
  ↓
Controllers
  ↓
Services
  ↓
Prisma ORM
  ↓
PostgreSQL
```

La solución complementa este flujo mediante:

```text
middlewares/
jobs/
validations/
utils/
config/
services/
```

### Responsabilidades principales

**Routes**

Definen endpoints y aplican los middlewares correspondientes.

**Controllers**

Gestionan requests y responses HTTP y delegan la lógica de negocio.

**Services**

Concentran reglas de negocio, validaciones, transacciones, auditoría e integración entre módulos.

**Middlewares**

Gestionan autenticación, autorización, manejo de errores y procesamiento de archivos.

**Prisma ORM**

Gestiona acceso, relaciones y transacciones sobre PostgreSQL.

---

## Módulos principales

### Autenticación y seguridad

El sistema implementa un flujo completo de autenticación que incluye:

- Inicio y cierre de sesión.
- Autenticación mediante JWT.
- Autorización por roles.
- Roles `ADMIN` y `SOCIO`.
- Invalidación y versionado de sesiones.
- Contraseñas almacenadas mediante hashing.
- Cambio obligatorio de contraseña temporal.
- Recuperación segura de contraseña.
- Control de intentos de acceso.
- Manejo centralizado de errores de autenticación.

### Multi-Factor Authentication

Las cuentas administrativas pueden utilizar autenticación multifactor mediante TOTP.

La implementación contempla:

- Configuración de MFA.
- Verificación de códigos TOTP.
- Challenges temporales de autenticación.
- Secretos protegidos.
- Códigos de recuperación.
- Desactivación segura de MFA.

---

### Socios

Administración del ciclo de vida de los socios:

- Alta.
- Consulta.
- Edición.
- Estados `ACTIVO`, `INACTIVO` y `SUSPENDIDO`.
- Reglas de transición de estados.
- Consentimiento informado.
- Vinculación entre Socio y Usuario.
- Restricciones de acceso según estado.
- Invalidación de sesiones ante determinadas transiciones.
- Cancelación de reservas activas cuando corresponde.

---

### Productos

Gestión administrativa del catálogo:

- Alta y edición.
- Flores y semillas.
- Genética.
- THC.
- Precio.
- Estados activo/inactivo.
- Integración con inventario.
- Gestión de imágenes mediante Amazon S3.

Las imágenes son validadas tanto por MIME type como mediante inspección de su contenido binario real antes de almacenarse.

También se implementaron mecanismos de compensación para evitar archivos huérfanos en S3 cuando una operación de persistencia falla.

---

### Stock

El inventario mantiene de forma independiente:

- Stock total.
- Stock reservado.
- Stock disponible.

Todos los cambios generan movimientos trazables.

Entre las operaciones soportadas se encuentran:

- Ingresos.
- Egresos.
- Reservas.
- Liberaciones.
- Ajustes.
- Consumo de stock reservado.

Las operaciones críticas utilizan transacciones y bloqueos de filas de PostgreSQL para preservar la consistencia ante solicitudes concurrentes.

---

### Reservas

El módulo implementa el ciclo completo de reservas:

```text
PENDIENTE
    ↓
CONFIRMADA
   ↙  ↓  ↘
CANCELADA
VENCIDA
FINALIZADA
```

Incluye:

- Solicitud de reserva.
- Validación automática.
- Control de stock.
- Bloqueo de inventario.
- Fecha límite de retiro.
- Cancelación.
- Vencimiento automático.
- Confirmación de retiro.
- Conversión de reserva en venta.
- Historial de estados.
- Auditoría.
- Notificaciones.

Un job automático procesa las reservas confirmadas cuyo plazo de retiro expiró.

---

### Ventas

El módulo permite:

- Registrar ventas.
- Generar detalles de venta.
- Calcular importes.
- Descontar stock.
- Registrar movimientos de inventario.
- Anular ventas.
- Restituir stock ante anulaciones.
- Registrar auditoría.

También participa en la validación del límite mensual permitido para cada socio.

---

### Compras y proveedores

La plataforma permite administrar:

- Proveedores.
- Estados de proveedores.
- Registro de compras.
- Detalles de compra.
- Costos.
- Ingreso automático de stock.
- Historial y trazabilidad.

Las operaciones se ejecutan de manera transaccional para evitar inconsistencias entre compra e inventario.

---

### Novedades y notificaciones

El backend soporta comunicaciones y notificaciones relacionadas con diferentes eventos del sistema.

Entre ellas:

- Reservas confirmadas.
- Reservas canceladas.
- Reservas vencidas.
- Novedades institucionales.

La entrega por email se encuentra centralizada para evitar acoplar las reglas de negocio al proveedor de correo.

---

### Dashboard

El sistema dispone de endpoints específicos para alimentar el dashboard administrativo y presentar información operativa obtenida desde los diferentes dominios de la plataforma.

---

## Integridad transaccional y concurrencia

Uno de los aspectos principales del backend es el tratamiento explícito de operaciones concurrentes.

Se utilizan transacciones de PostgreSQL y bloqueos mediante:

```sql
SELECT ... FOR UPDATE
```

para proteger entidades críticas como:

- Socios.
- Stock.
- Reservas.
- Ventas.
- Proveedores.

Esto permite evitar escenarios como:

- Dos operaciones consumiendo simultáneamente el mismo stock.
- Stock negativo.
- Dos retiros sobre la misma reserva.
- Dos anulaciones sobre la misma venta.
- Una reserva procesándose mientras el socio cambia de estado.
- Operaciones simultáneas superando el límite mensual permitido.
- Transiciones de estado duplicadas.

Cuando una operación involucra múltiples productos, los bloqueos se adquieren siguiendo un orden determinista para reducir el riesgo de deadlocks.

---

## Testing

El backend incluye pruebas de integración específicas para validar escenarios críticos de concurrencia.

Entre los casos implementados se encuentran:

### Stock concurrente

Dos operaciones simultáneas no pueden consumir más stock del disponible.

### Retiro concurrente

Dos solicitudes simultáneas no pueden finalizar dos veces la misma reserva ni generar dos ventas.

### Límite mensual concurrente

Dos operaciones concurrentes para un mismo socio no pueden superar conjuntamente el límite mensual permitido.

### Anulación concurrente

Dos solicitudes simultáneas no pueden anular una venta dos veces ni restituir dos veces el inventario.

Las pruebas utilizan una base PostgreSQL independiente y poseen protecciones para evitar ejecutarse accidentalmente sobre una base que no sea de testing.

Ejecutar:

```bash
npm test
```

---

## Manejo global de errores

El backend utiliza un mecanismo centralizado de errores.

Las excepciones de negocio son propagadas hacia un middleware global encargado de generar respuestas HTTP consistentes.

Esto evita duplicar lógica de manejo de errores en controllers y servicios.

---

## Seguridad de configuración

Las credenciales y secretos no forman parte del código fuente.

La configuración sensible se obtiene mediante variables de entorno.

El repositorio incluye únicamente un archivo:

```text
.env.example
```

con las variables necesarias y valores de ejemplo.

Entre ellas:

```text
DATABASE_URL
JWT_SECRET
ENCRYPTION_KEY
SMTP_USER
SMTP_PASSWORD
GEMINI_API_KEY
AWS_REGION
AWS_S3_BUCKET
AWS_S3_PUBLIC_BASE_URL
```

Los archivos `.env` reales se encuentran excluidos del control de versiones.

---

## Instalación local

### Requisitos

- Node.js 22.12 o superior.
- PostgreSQL.
- npm.

### 1. Clonar el repositorio

```bash
git clone https://github.com/MauroGiaccobasso-Git/green-acress-backend.git
cd green-acress-backend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crear un archivo:

```text
.env
```

tomando como referencia:

```text
.env.example
```

y configurar las variables correspondientes al entorno local.

### 4. Generar Prisma Client

```bash
npm run prisma:generate
```

### 5. Aplicar migraciones

```bash
npm run migrate:deploy
```

### 6. Ejecutar el backend

```bash
npm run dev
```

Por defecto:

```text
http://localhost:8080
```

---

## Scripts principales

```bash
npm run dev
```

Ejecuta el backend en desarrollo.

```bash
npm start
```

Ejecuta el servidor.

```bash
npm run prisma:generate
```

Genera Prisma Client.

```bash
npm run migrate:deploy
```

Aplica las migraciones disponibles.

```bash
npm test
```

Ejecuta las pruebas de concurrencia e integración configuradas.

---

## Repositorio Frontend

La interfaz web de Green Acres se encuentra en un repositorio independiente:

https://github.com/MauroGiaccobasso-Git/green-acress-frontend

El frontend fue desarrollado con Next.js, React y TypeScript y consume esta API REST.

---

## Proyecto académico

Green Acres fue desarrollado como Proyecto Integrador de la carrera **Analista en Tecnologías de la Información — Universidad ORT Uruguay, 2026**.

El proyecto abarca análisis funcional, diseño de arquitectura, desarrollo Full Stack, persistencia de datos, seguridad, testing, documentación técnica y despliegue cloud.