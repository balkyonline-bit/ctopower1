import { createRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import "~/i18n/index";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    defaultNotFoundComponent: NotFound,

  });
}

function NotFound() {
  const { t } = useTranslation();
  return <p>{t("common.notFound")}</p>;
}
