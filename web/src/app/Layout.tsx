import { Link, Outlet } from "react-router";

export function Layout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4">
      <header className="py-6">
        <Link
          to="/"
          className="text-lg font-semibold tracking-tight text-brand-600 dark:text-brand-500"
        >
          Live Poll
        </Link>
      </header>

      <main className="flex-1">
        {/* <Outlet /> é onde a rota filha que casou com a URL é renderizada */}
        <Outlet />
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        Express 5 · ws · React — portfolio project
      </footer>
    </div>
  );
}
