// Expectativa honesta: é uma demo, sem banco de dados. Melhor avisar antes do que
// o visitante descobrir quando a enquete dele sumir.
export function DemoBanner() {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      Demo project: polls are kept in memory only, so they disappear when the server restarts or
      goes to sleep.
    </p>
  );
}
