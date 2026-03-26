# D'Mar POS (Mobile) - `dmar-mobile`

Front-end móvil basado en **React + TypeScript + Vite**, con empaquetado mediante **Capacitor**. Funciona en modo **offline-first** usando **Firebase (Firestore + Auth)**.

## Propósito

Aplicación móvil para operar el **Punto de Venta (POS) de D'Mar Boutique**, con acceso a datos y operaciones incluso sin conexión (sincronización automática cuando vuelve la red).

## Arquitectura (Offline-First)

- **Capacitor**: sirve el front-end (Vite) dentro de una app Android/iOS.
- **UI (React)**: componentes y páginas del POS; la navegación es web (SPA).
- **Autenticación (Firebase Auth)**: mantiene sesión con persistencia local.
- **Datos (Firestore)**:
  - `src/firebase/config.ts` inicializa Firestore con persistencia offline (`persistentLocalCache`).
  - Las escrituras se encolan y luego se sincronizan automáticamente cuando hay conectividad.
- **Red**: existen utilidades para activar/desactivar red en Firestore (`disableNetwork`/`enableNetwork`).

## Requisitos

- Node.js 18+ y npm
- Para móvil con Capacitor:
  - Android: Android Studio + SDK
  - iOS: Xcode (solo macOS)

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
```

## Lint / Preview

```bash
npm run lint
npm run preview
```

## Capacitor (Android / iOS)

1. Genera el build web:
   ```bash
   npm run build
   ```
2. Sincroniza el proyecto nativo:
   ```bash
   npx cap sync
   ```
3. Abre en el IDE:
   ```bash
   npx cap open android
   ```
   o (macOS):
   ```bash
   npx cap open ios
   ```

Si es la primera vez y aún no existen las carpetas nativas:

```bash
npx cap add android
npx cap add ios
```

## Referencias

- Capacitor: `capacitor.config.ts` (define `webDir: dist`)
- Firebase: `src/firebase/config.ts`
