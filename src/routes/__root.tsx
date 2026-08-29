import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import "~/i18n/index";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, LANG_STORAGE_KEY, type SupportedLanguage } from "~/i18n/index";

import appCss from "~/styles/app.css?url";

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
  const { i18n } = useTranslation();

  return (
    <RootDocument lang={i18n.language}>
      <NavBar />
      <Outlet />
      <Footer />
    </RootDocument>
  );
}

function RootDocument({ children, lang }: { children: ReactNode; lang: string }) {
  return (
    <html lang={lang} className="dark">
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
  const { t, i18n } = useTranslation();

  const NAV_LINKS = [
    { name: t("nav.dashboard"), href: "/dashboard" },
    { name: t("nav.gallery"), href: "/gallery" },
    { name: t("nav.social"), href: "/social" },
    { name: "📧 Email", href: "/email" },
    { name: t("nav.monetization"), href: "/monetization" },
    { name: t("nav.demo"), href: "/tech" },
  ] as const;

  const handleLanguageSwitch = (lang: SupportedLanguage) => {
    i18n.changeLanguage(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  };

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
          {/* Language Switcher */}
          <div className="flex items-center gap-1 border-l border-gray-700 pl-4 ml-2">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang}
                onClick={() => handleLanguageSwitch(lang)}
                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                  i18n.language === lang
                    ? "bg-indigo-500/20 text-indigo-300 font-medium"
                    : "text-gray-500 hover:text-gray-300"
                }`}
                title={LANGUAGE_LABELS[lang]}
              >
                {LANGUAGE_LABELS[lang]}
              </button>
            ))}
          </div>
          <a
            href="/"
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:shadow-lg hover:shadow-indigo-500/25"
          >
            {t("nav.getStarted")}
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
              <li className="border-t border-gray-800 mt-1 pt-1">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleLanguageSwitch(lang)}
                    className={`block w-full text-left px-4 py-2 text-xs ${
                      i18n.language === lang
                        ? "bg-indigo-500/20 text-indigo-300"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                    }`}
                  >
                    {LANGUAGE_LABELS[lang]}
                  </button>
                ))}
              </li>
              <li>
                <a
                  href="/"
                  className="block px-4 py-2 text-sm font-semibold text-indigo-400 hover:bg-gray-800"
                >
                  {t("nav.getStarted")}
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
  const { t } = useTranslation();

  return (
    <footer className="border-t border-gray-800 bg-gray-950 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 text-center">
        <p className="text-sm text-gray-500">{t("footer.poweredBy")}</p>
        <p className="text-xs text-gray-600">
          {t("footer.tagline")}
        </p>
      </div>
    </footer>
  );
}
