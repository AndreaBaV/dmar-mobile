/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG_CONSOLE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
