import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-slate-600 dark:text-slate-400">The address you opened does not exist.</p>
      {/* <Link> troca a página sem recarregar o site (diferente de <a href>) */}
      <Link to="/" className="text-brand-600 underline dark:text-brand-500">
        Back to home
      </Link>
    </section>
  );
}
