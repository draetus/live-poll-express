import { ApiStatus } from "../components/ApiStatus";

export function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">
        Create a poll. Share the link. Watch it live.
      </h1>
      <p className="text-slate-600 dark:text-slate-400">
        Votes appear on every screen in real time, without refreshing the page.
      </p>
      <ApiStatus />
      {/* Fase 4: formulário de criação + enquetes em destaque (seed) */}
    </section>
  );
}
