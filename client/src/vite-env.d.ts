/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_URL_GENEXUS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
