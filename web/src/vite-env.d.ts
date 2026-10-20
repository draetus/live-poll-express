// Tipagem das variáveis de ambiente que o Vite injeta em import.meta.env.
// Só variáveis com prefixo VITE_ chegam ao navegador (e ficam VISÍVEIS no bundle:
// nunca coloque segredo aqui).
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
