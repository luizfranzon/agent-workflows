import { useEffect, useState } from "react";
import { NavRail, NavRailItem, type Navigate } from "./shared/design-system";
import { AgentsPage } from "./AgentsPage";
import { WorkflowsPage } from "./WorkflowsPage";

export type Route = { page: "workflows" | "agentes"; name: string | null };

function routeOf(pathname: string): Route {
  const [page, name] = pathname.split("/").filter(Boolean);
  return { page: page === "agentes" ? "agentes" : "workflows", name: name ? decodeURIComponent(name) : null };
}

export function App() {
  const [route, setRoute] = useState(() => routeOf(location.pathname));

  useEffect(() => {
    const followHistory = () => setRoute(routeOf(location.pathname));
    addEventListener("popstate", followHistory);
    return () => removeEventListener("popstate", followHistory);
  }, []);

  const navigate: Navigate = (href) => {
    if (href !== location.pathname) history.pushState(null, "", href);
    setRoute(routeOf(href));
  };

  const rail = (
    <NavRail>
      <NavRailItem href="/workflows" icon="workflow" label="Workflows" current={route.page === "workflows"} onNavigate={navigate} />
      <NavRailItem href="/agentes" icon="agent" label="Agentes" current={route.page === "agentes"} onNavigate={navigate} />
    </NavRail>
  );

  if (route.page === "agentes") return <AgentsPage rail={rail} selectedName={route.name} navigate={navigate} />;
  return <WorkflowsPage rail={rail} selectedName={route.name} navigate={navigate} />;
}
