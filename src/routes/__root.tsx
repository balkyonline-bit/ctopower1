import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "~/styles/app.css?url";

const NAV_LINKS = [
  { name: "Platform", href: "#platform" },
  { name: "Demo", href: "/tech" },
  { name: "Pricing", href: "#pricing" },
] as const;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EmpireAI — AI-Powered Content Empire" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => <div>Page not found</div>,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <NavBar />
      <Outlet />
      <Footer />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <a
          href="/"
          className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent"
        >
          EmpireAI
        </a>
        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-gray-400 transition hover:text-gray-200"
            >
              {link.name}
            </a>
          ))}
          <a
            href="/"
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-indigo-500/25"
          >
            Get Started
          </a>
        </div>
        {/* Mobile menu */}
        <div className="md:hidden">
          <details className="group relative">
            <summary className="cursor-pointer list-none rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-gray-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-6 w-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </summary>
            <ul className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-gray-800 bg-gray-900 py-2 shadow-xl">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="block px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="/"
                  className="block px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-gray-800"
                >
                  Get Started
                </a>
              </li>
            </ul>
          </details>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center">
        <p className="text-sm text-gray-500">Powered by EmpireAI</p>
        <p className="text-xs text-gray-600">
          AI-Powered Content Empire &mdash; autonomous niche content sites run by
          specialized AI agent teams.
        </p>
      </div>
    </footer>
  );
}
