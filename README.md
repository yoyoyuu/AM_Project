# Koma

**Koma** es una aplicación móvil Android que centraliza el registro, el seguimiento y el cierre de **comisiones de arte digital** entre ilustradores independientes y sus clientes.

Una sola cuenta por persona, dos roles: cualquier usuario puede solicitar comisiones, y quien lo desee puede activar un perfil de artista (con *handle* público) para ofrecerlas. Todo —desde la búsqueda del artista hasta la entrega final— ocurre dentro de la app.

> MVP versión móvil académico desarrollado para la materia **Aplicaciones Móviles** — ciclo 2026-2.

---

## Características

- **Cuenta única cliente/artista** con cambio de rol en caliente.
- **Catálogo de servicios** por artista, con TOS propios y perfil público buscable por `@handle`.
- **Solicitud de comisión** con descripción, pose, elementos clave, uso previsto e imágenes de referencia.
- **Flujo de estado completo:** solicitud → aceptación/rechazo → en progreso → avances → entregable → cierre.
- **Avances por etapa** (boceto, line art, color, final) con galería de imágenes.
- **Pagos fuera del sistema** con comprobante verificable: el cliente sube evidencia, el artista aprueba o pide corrección. El entregable solo se desbloquea con el pago aprobado.
- **Notificaciones push** para los eventos clave de la comisión (FCM + Expo Push + Edge Function).
- **Guardado del entregable** en la galería del dispositivo.
- **Modo offline resiliente:** la app detecta la ausencia de red, bloquea acciones de inmediato y muestra feedback, sin spinners infinitos.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| App | Expo SDK 58 · React Native 0.88 · React 19.2 · TypeScript estricto · **solo Android** |
| Navegación | Expo Router (file-based) |
| Formularios + validación | React Hook Form + Zod |
| Estado remoto / caché | TanStack Query (React Query) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Correo (solo auth) | Resend como SMTP de Supabase Auth |
| Push | `expo-notifications` + Expo Push + Firebase Cloud Messaging |
| Imágenes | `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-media-library` |
| Conectividad | `@react-native-community/netinfo` |
| Build / distribución | EAS Build (development build + APK interna) |
| Calidad | ESLint (`expo lint`) + Jest + `jest-expo` |

Cualquier cambio de stack requiere una enmienda en [`constitution.md`](constitution.md).

---

## Estructura del repositorio

```
koma/
├─ src/
│  ├─ app/                # Rutas Expo Router (cada archivo = pantalla)
│  ├─ components/         # Componentes UI reutilizables (Button, Text, Badge, …)
│  ├─ features/           # Features por dominio (una carpeta = una spec)
│  │  ├─ auth/            # Sesión, perfil, cambio de rol
│  │  ├─ catalogo/        # Servicios + TOS + perfil público
│  │  ├─ solicitud/       # Solicitud de comisión (cliente)
│  │  ├─ gestion/         # Gestión y máquina de estados (artista)
│  │  ├─ seguimiento/     # Seguimiento del cliente
│  │  ├─ avances/         # Avances por etapa
│  │  ├─ pagos/           # Comprobantes y verificación
│  │  ├─ entregables/     # Entregable final + galería
│  │  └─ notificaciones/  # Push notifications
│  ├─ lib/                # Utilidades transversales (supabase, netinfo…)
│  └─ theme/              # Tokens de diseño
├─ supabase/
│  ├─ migrations/         # DDL versionado
│  └─ tests/              # pgTAP / pruebas RLS
├─ specs/                 # Specs por feature (spec.md, plan.md, tasks.md)
├─ assets/                # Íconos, splash, imágenes
├─ __tests__/             # Pruebas de integración
├─ app.json / app.config.ts
├─ eas.json
├─ constitution.md        # Principios no negociables del proyecto
├─ BITACORA_IA.md         # Registro de sesiones con el asistente de IA
└─ DIARIO_DECISIONES.md   # Decisiones técnicas y de producto
```

Expo Router convierte cada archivo dentro de `src/app/` en una ruta. El resto del código vive **fuera** de `src/app/`.

---

## Puesta en marcha

### Prerrequisitos

- **Node.js 20+**
- **Android Studio** (para emulador) o un dispositivo Android con [Expo Dev Client](https://docs.expo.dev/develop/development-builds/introduction/) instalado.
- Cuenta de **Supabase** (free tier).
- Proyecto de **Firebase** con FCM habilitado (para notificaciones push).

### 1. Clonar e instalar

```bash
git clone https://github.com/yoyoyuu/AM_Project.git
cd AM_Project
npm install
```

### 2. Configurar variables de entorno

Copia `.env.example` a `.env` y completa:

```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=tu-anon-key
```

> ⚠️ **Nunca** pongas la `service_role key` ni secretos de Firebase en variables `EXPO_PUBLIC_*`: todo lo prefijado con `EXPO_PUBLIC_` queda embebido en el bundle.

### 3. Firebase (push notifications)

Coloca tu `google-services.json` en la raíz del proyecto (ya está referenciado en `app.json`). Para configurar la Edge Function de envío, revisa [`specs/008-notificaciones-push/`](specs/008-notificaciones-push/).

### 4. Aplicar migraciones de Supabase

Las migraciones están en [`supabase/migrations/`](supabase/migrations/) y se aplican **manualmente desde el editor SQL de Supabase** (ver decisión D-011 en [`DIARIO_DECISIONES.md`](DIARIO_DECISIONES.md)). Ejecútalas en orden numérico.

### 5. Levantar la app

```bash
npx expo start           # Metro bundler
npx expo run:android     # build nativo + arranque (primera vez / nuevo módulo nativo)
```

Como la app usa módulos nativos no incluidos en Expo Go (push, media library), necesitas un **development build**. No uses Expo Go.

---

## Calidad

Antes de dar por terminada cualquier tarea:

```bash
npx expo lint        # ESLint
npx tsc --noEmit     # TypeScript
npm test             # Jest
npx expo-doctor      # diagnóstico de dependencias
```

Hay pruebas unitarias en cada feature (`src/features/*/\_\_tests\_\_/`), pruebas de integración en `__tests__/`, y pruebas SQL/RLS en `supabase/tests/`.

---

## Builds con EAS

```bash
npx eas-cli@latest build --profile development --platform android   # dev build
npx eas-cli@latest build --profile preview --platform android       # APK interna
npx eas-cli@latest update                                           # OTA
```

Los perfiles están configurados en [`eas.json`](eas.json). No se soporta iOS ni web en este MVP.

---

## Documentación del proyecto

- [`constitution.md`](constitution.md) — Principios no negociables.
- [`specs/`](specs/) — Una carpeta por feature con `spec.md` (qué), `plan.md` (cómo) y `tasks.md` (checklist).
- [`BITACORA_IA.md`](BITACORA_IA.md) — Registro de las sesiones con el asistente de IA usadas durante el desarrollo.
- [`DIARIO_DECISIONES.md`](DIARIO_DECISIONES.md) — Decisiones técnicas y de producto con contexto, alternativas y consecuencias.
- [`AGENTS.md`](AGENTS.md) / [`CLAUDE.md`](CLAUDE.md) — Guía para agentes de IA que trabajan sobre el repo.

---

## Seguridad y privacidad

- **Row Level Security (RLS)** habilitado en todas las tablas.
- Transiciones de estado críticas se ejecutan como **RPC** en Supabase, no como `update` desde el cliente.
- Las URLs de entregables y avances se sirven mediante **signed URLs** con expiración.
- Aviso de privacidad y consentimiento explícito antes de crear la cuenta (conforme a la **LFPDPPP** de México).
- El contenido de las notificaciones push es **discreto**: no expone datos sensibles en la pantalla de bloqueo.
- Los pagos **viven fuera del sistema**: Koma solo registra estado y comprobante; no procesa, custodia ni reembolsa dinero.

---

## Contribuir

1. Lee [`constitution.md`](constitution.md) y la spec correspondiente en `specs/`.
2. Crea una rama desde `main`.
3. Implementa siguiendo el flujo *spec-driven*: si tu código contradice la spec, **corrige la spec primero**.
4. Antes del PR: `npx expo lint && npx tsc --noEmit && npm test`.
5. Abre PR con referencia a la spec/tasks relevantes.

---

## Licencia

Ver [`LICENSE`](LICENSE).
