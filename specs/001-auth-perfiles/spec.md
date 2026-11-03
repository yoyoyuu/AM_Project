# Spec 001 — Cuenta, sesión y perfiles
 
**Estado:** Aprobada para plan · **Versión:** 0.3 · **Fecha:** 2026-11-02
**Prioridad:** Must have (bloquea todas las demás features)
**Constitución:** v1.1
 
> Esta spec describe **qué** debe hacer el sistema y **por qué**. Las decisiones de tecnología van en `plan.md`.
 
---
 
## 1. Contexto y objetivo
 
Todas las funciones de la app (catálogo, solicitudes, avances, pagos, notificaciones) requieren saber quién es el usuario. Artista y cliente usan **la misma cuenta**: se es artista al activar el perfil de artista, y cualquier usuario puede pedir comisiones.
 
**Objetivo:** que una persona pueda crear su cuenta, entrar, recuperar su acceso, completar su perfil y, si lo desea, activar su perfil de artista con un identificador público (handle) que otros usuarios usarán para encontrarla.
 
## 2. Historias de usuario
 
- **HU-1.** Como usuario, quiero crear una cuenta con mi correo y contraseña para usar la app.
- **HU-2.** Como usuario, quiero iniciar sesión y mantenerla abierta en mi celular para no escribir mis datos cada vez.
- **HU-3.** Como usuario, quiero recuperar mi contraseña por correo si la olvido.
- **HU-4.** Como usuario, quiero definir mi nombre para que artistas y clientes sepan quién soy.
- **HU-5.** Como artista, quiero activar mi perfil de artista y elegir mi handle para que mis clientes me encuentren.
- **HU-6.** Como usuario con perfil de artista, quiero cambiar entre usar la app como artista o como cliente.
- **HU-7.** Como usuario, quiero cerrar sesión para proteger mi cuenta en un dispositivo compartido.
## 3. Requerimientos funcionales
 
### RF-17 — Registra la cuenta (Must have)
 
El sistema deberá permitir a una persona crear una cuenta con correo electrónico y contraseña.
 
**Reglas**
- El correo debe tener formato válido y no estar registrado previamente.
- La contraseña debe tener al menos 8 caracteres.
- Se debe aceptar el aviso de privacidad antes de crear la cuenta (RNF-09).
- La contraseña se almacena cifrada con bcrypt (RNF-02).
- El correo debe verificarse con un código de un solo uso enviado por correo antes de acceder a la app. El código expira y puede reenviarse.
- Si el correo ya tiene cuenta, el sistema muestra la misma pantalla de verificación que en un registro nuevo (no revela si el correo existe).
**Escenarios**
- **Válido:** Dado un visitante en la pantalla de registro, cuando ingresa un correo válido y no registrado, una contraseña de 8 o más caracteres, acepta el aviso de privacidad y presiona "Crear cuenta", entonces el sistema solicita el código de verificación enviado a su correo.
- **Válido:** Dado un usuario con cuenta sin verificar, cuando ingresa el código correcto, entonces accede a la app y es llevado a completar su perfil (RF-20).
- **No válido:** El sistema crea una cuenta sin aceptar el aviso de privacidad o con contraseña corta, crea una segunda cuenta con un correo ya registrado, o permite acceder con el correo sin verificar o con un código vencido.
### RF-18 — Inicia y cierra la sesión (Must have)
 
El sistema deberá permitir al usuario iniciar sesión con su correo y contraseña, mantener la sesión en el dispositivo y cerrarla manualmente.
 
**Reglas**
- La sesión se identifica con un JWT (RNF-04).
- La sesión persiste al cerrar y reabrir la app, hasta que expire o el usuario la cierre.
- Al cerrar sesión se elimina la sesión almacenada en el dispositivo y se desvincula el dispositivo de las notificaciones push del usuario (spec 008).
- Un usuario autenticado que abre la app va directo a su pantalla de inicio; uno sin sesión va a la pantalla de inicio de sesión.
**Escenarios**
- **Válido:** Dado un usuario registrado, cuando ingresa correo y contraseña correctos, entonces accede a la app.
- **Válido:** Dado un usuario con sesión vigente, cuando reabre la app, entonces ve su pantalla de inicio sin volver a ingresar credenciales.
- **Válido:** Dado un usuario con sesión, cuando presiona "Cerrar sesión", entonces regresa al inicio de sesión y no puede volver a la app con el botón atrás.
- **No válido:** El sistema revela si el correo existe o no al fallar el inicio de sesión (se usa un mensaje genérico).
### RF-19 — Recupera la contraseña (Should have)
 
El sistema deberá permitir al usuario solicitar un correo para restablecer su contraseña y definir una nueva.
 
**Reglas**
- La respuesta a la solicitud es la misma exista o no el correo (no se revela si hay cuenta).
- El código de restablecimiento es de un solo uso y expira.
- La nueva contraseña cumple la misma regla de RF-17.
**Escenarios**
- **Válido:** Dado un usuario que olvidó su contraseña, cuando ingresa su correo en "Olvidé mi contraseña", entonces ve un aviso de que si el correo existe recibirá instrucciones, y recibe el correo.
- **Válido:** Dado un usuario con un código vigente, cuando ingresa el código y una nueva contraseña válida, entonces puede iniciar sesión con ella y la anterior deja de funcionar.
- **No válido:** El sistema permite reutilizar un código ya usado o vencido.
### RF-20 — Completa el perfil básico (Must have)
 
El sistema deberá exigir al usuario un nombre visible antes de usar la app.
 
**Reglas**
- **Nombre:** obligatorio, entre 2 y 50 caracteres.
- Mientras el nombre no esté definido, el usuario no puede acceder al resto de la app.
- El usuario puede editar su nombre después.
**Escenarios**
- **Válido:** Dado un usuario recién verificado, cuando ingresa un nombre válido y guarda, entonces accede a su pantalla de inicio.
- **No válido:** El sistema guarda un nombre vacío o fuera de longitud, o permite entrar a la app sin nombre.
### RF-21 — Activa el perfil de artista (Must have)
 
El sistema deberá permitir a un usuario activar su perfil de artista definiendo un identificador público (handle) único.
 
**Reglas**
- **Handle:** obligatorio para ser artista, único, de 3 a 30 caracteres, solo minúsculas, números y guiones, sin empezar ni terminar con guion ni tener guiones seguidos.
- No se permiten handles reservados (palabras que chocan con rutas o con la marca).
- Mientras no tenga handle, el usuario no puede publicar servicios ni recibir solicitudes.
- Una vez activo el perfil de artista, no se puede desactivar en esta versión.
- El usuario puede cambiar su handle; el sistema advierte antes de confirmar que el handle anterior dejará de funcionar.
**Escenarios**
- **Válido:** Dado un usuario con perfil básico completo, cuando elige "Quiero ofrecer comisiones" e ingresa un handle disponible y válido, entonces su perfil de artista queda activo y ve su handle.
- **No válido:** El sistema guarda un handle duplicado, reservado, con mayúsculas, espacios o caracteres especiales.
### RF-22 — Elige el modo de uso (Should have)
 
El sistema deberá permitir a un usuario con perfil de artista alternar entre usar la app como artista o como cliente, y recordar su última elección en el dispositivo.
 
**Escenarios**
- **Válido:** Dado un artista en modo artista, cuando cambia a modo cliente, entonces ve las pantallas de cliente y al reabrir la app conserva ese modo.
- **No válido:** Un usuario sin perfil de artista ve opciones de artista en lugar de la invitación a activarlo.
## 4. Errores y mensajes
 
| Situación | Comportamiento | Mensaje |
|---|---|---|
| Campo vacío o inválido en registro/login | No envía; marca el campo | "Completa este campo con un valor válido" |
| Correo ya registrado | Muestra la misma pantalla de verificación que un registro nuevo; no crea otra cuenta | "Te enviamos un código a tu correo" |
| Contraseña menor a 8 caracteres | No crea la cuenta | "La contraseña debe tener al menos 8 caracteres" |
| Aviso de privacidad sin aceptar | Bloquea el envío | "Debes aceptar el aviso de privacidad" |
| Código de verificación incorrecto o vencido | No da acceso | "El código no es válido o venció, solicita uno nuevo" |
| Inicio de sesión con correo sin verificar | Lleva a la pantalla de verificación | "Verifica tu correo para continuar" |
| Credenciales incorrectas | No inicia sesión; sin revelar cuál dato falló | "Correo o contraseña incorrectos" |
| Demasiados intentos fallidos | Bloquea temporalmente | "Demasiados intentos, inténtalo más tarde" |
| Fallo de conexión | Conserva lo capturado | "No se pudo conectar, reintente más tarde" |
| Código de restablecimiento inválido o vencido | No permite cambiar la contraseña | "El código no es válido o venció, solicita uno nuevo" |
| Nombre fuera de longitud | No guarda | "El nombre debe tener entre 2 y 50 caracteres" |
| Handle duplicado | No guarda | "Ese identificador ya está en uso" |
| Handle con formato inválido | No guarda | "Usa solo minúsculas, números y guiones (3 a 30 caracteres)" |
| Handle reservado | No guarda | "Ese identificador no está disponible" |
 
> La respuesta ante un correo ya registrado es neutra a propósito, para no revelar qué correos tienen cuenta.
 
## 5. Requerimientos no funcionales aplicables
 
| ID | Aplicación en esta spec | Métrica |
|---|---|---|
| RNF-01 | Registro e inicio de sesión responden rápido | ≤ 2.0 s con 50 usuarios concurrentes |
| RNF-02 | Contraseñas con bcrypt | 0 contraseñas en texto plano |
| RNF-04 | Sesión con JWT y acceso por usuario autenticado | 100 % de peticiones sin sesión válida reciben 401/403 |
| RNF-09 | Aviso de privacidad y consentimiento | El registro no se envía sin la casilla |
| RI-04 | Todo por HTTPS | Sin tráfico HTTP |
 
**Adicionales propuestos (nuevos RNF):**
- Limitación de intentos de inicio de sesión y de solicitudes de recuperación para frenar abuso.
- La sesión almacenada en el dispositivo debe guardarse de forma segura, no en texto plano accesible.
- Pantallas legibles y usables en celulares Android de pantalla pequeña (≥ 360 px de ancho).
## 6. Entidades (conceptual)
 
- **Perfil de usuario:** identificador, correo, contraseña (cifrada), nombre, handle (solo si es artista), consentimiento de privacidad (fecha y versión), fecha de registro.
- **Es artista:** se deriva de tener handle.
El diseño de tablas, políticas RLS y contratos va en `plan.md`.
 
## 7. Fuera de alcance de esta spec
 
- Inicio de sesión con Google u otros proveedores.
- Verificación de identidad del artista o detección de IA (RNF-03, Won't have v1).
- Autenticación de dos factores.
- Eliminación de cuenta y exportación de datos (se evaluará por la LFPDPPP).
- Desactivar el perfil de artista.
- Foto de perfil, biografía y redes sociales.
- Notificaciones push (spec 008) y buscar artistas por handle o QR (spec 002).
## 8. Decisiones tomadas
 
| ID | Tema | Decisión |
|---|---|---|
| P-1 | Verificación de correo | **Obligatoria**, con código de un solo uso (Resend como SMTP). El flujo se implementa completo desde el inicio; se activa cuando esté listo el dominio. Los usuarios reales solo se registran con la verificación activa. |
| P-2 | Registro con correo duplicado | Respuesta neutra: misma pantalla de verificación exista o no la cuenta. |
| P-3 | Expiración del JWT | **24 h** (RNF-04) con refresh token. Si se decide endurecer, se baja a 1 h; la experiencia no cambia. |
| P-4 | Handles reservados | Lista definida en `plan.md`. |
| P-5 | Eliminación de datos (LFPDPPP) | Para el MVP, un correo de contacto en el aviso de privacidad. |
| P-6 | Cliente y artista | **Una sola cuenta**; el rol de artista se activa con un handle. El cliente no usa tokens ni enlaces. |
 
## 9. Trazabilidad
 
| Requerimiento | Origen | Estado en SRS v4.0 |
|---|---|---|
| RF-17 | RNF-02, RNF-04 (asumen cuentas); RNF-09 | **Nuevo** |
| RF-18 | RNF-04 | **Nuevo** |
| RF-19 | Buena práctica de seguridad | **Nuevo** |
| RF-20 | Identificación en solicitudes y avances | **Nuevo** |
| RF-21 | Catálogo público (RF-02) y rol de artista | **Nuevo** |
| RF-22 | Uso de ambos roles con una cuenta | **Nuevo** |
 
## 10. Checklist de aceptación
 
- [ ] Todos los escenarios válidos de RF-17 a RF-22 pasan.
- [ ] Todos los escenarios no válidos están cubiertos por una prueba.
- [ ] Cada fila de la tabla de errores tiene una prueba con el mensaje exacto.
- [ ] Inspección: 0 contraseñas en texto plano.
- [ ] Prueba de acceso: peticiones sin sesión válida reciben 401/403.
- [ ] El registro no se puede enviar sin aceptar el aviso de privacidad.
- [x] Las preguntas P-1 a P-6 están resueltas (sección 8).
- [ ] Una cuenta sin verificar no accede a la app (con la verificación activa).
 