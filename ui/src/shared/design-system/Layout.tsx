import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function AppShell({
  header,
  rail,
  contextNav,
  contextNavOpen = true,
  detailPanel,
  children,
}: {
  header: ReactNode;
  rail: ReactNode;
  contextNav?: ReactNode;
  contextNavOpen?: boolean;
  detailPanel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <div className="app-shell__header">{header}</div>
      <div className="app-shell__rail">{rail}</div>
      {contextNav && (
        <div id={CONTEXT_NAV_ID} className="app-shell__context" data-open={contextNavOpen} inert={!contextNavOpen}>
          <div className="app-shell__context-content">{contextNav}</div>
        </div>
      )}
      <main className="app-shell__main">{children}</main>
      {detailPanel && <aside className="app-shell__detail">{detailPanel}</aside>}
    </div>
  );
}

const CONTEXT_NAV_ID = "app-shell-context";

export function NavRailButton({
  icon,
  label,
  expanded,
  onClick,
  badge,
  controls = CONTEXT_NAV_ID,
}: {
  icon: IconName;
  label: string;
  expanded: boolean;
  onClick: () => void;
  badge?: number;
  controls?: string;
}) {
  return (
    <button type="button" className="nav-rail__item" aria-expanded={expanded} aria-controls={controls} onClick={onClick}>
      <Icon name={icon} size={18} />
      <span className="nav-rail__label">{label}</span>
      {badge !== undefined && badge > 0 && <span className="nav-rail__badge">{badge}</span>}
    </button>
  );
}

export type Navigate = (href: string) => void;

function followLink(event: MouseEvent<HTMLAnchorElement>, navigate: Navigate) {
  const opensElsewhere = event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0;
  if (opensElsewhere) return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute("href")!);
}

export function AppLink({
  href,
  onNavigate,
  ...anchorAttributes
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate: Navigate }) {
  return <a {...anchorAttributes} href={href} onClick={(event) => followLink(event, onNavigate)} />;
}

export function NavRail({ children }: { children: ReactNode }) {
  return (
    <nav className="nav-rail" aria-label="Navegação principal">
      {children}
    </nav>
  );
}

export function NavRailItem({
  href,
  icon,
  label,
  current = false,
  badge,
  onNavigate,
}: {
  href: string;
  icon: IconName;
  label: string;
  current?: boolean;
  badge?: number;
  onNavigate: Navigate;
}) {
  return (
    <AppLink
      className="nav-rail__item"
      href={href}
      aria-current={current ? "page" : undefined}
      onNavigate={onNavigate}
    >
      <Icon name={icon} size={18} />
      <span className="nav-rail__label">{label}</span>
      {badge !== undefined && badge > 0 && <span className="nav-rail__badge">{badge}</span>}
    </AppLink>
  );
}

export function PageHeader({ crumbs = [], title, actions }: { crumbs?: ReactNode[]; title?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      {(crumbs.length > 0 || title) && (
        <nav className="page-header__crumbs" aria-label="Você está em">
          {crumbs.map((crumb, index) => (
            <span key={index} className="page-header__crumb">
              {crumb}
              <span className="page-header__separator" aria-hidden="true">
                /
              </span>
            </span>
          ))}
          {title && <h1 className="page-header__title">{title}</h1>}
        </nav>
      )}
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export function SidebarSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="sidebar-section" aria-label={title}>
      <div className="sidebar-section__header">
        <h2 className="sidebar-section__title">{title}</h2>
        {action}
      </div>
      <ul className="sidebar-section__list">{children}</ul>
    </section>
  );
}

export function NavItem({
  href,
  icon,
  label,
  current = false,
  trailing,
  onNavigate,
}: {
  href: string;
  icon?: IconName;
  label: string;
  current?: boolean;
  trailing?: ReactNode;
  onNavigate: Navigate;
}) {
  return (
    <li>
      <AppLink
        className="nav-item"
        href={href}
        aria-current={current ? "page" : undefined}
        onNavigate={onNavigate}
      >
        {icon && <Icon name={icon} size={14} />}
        <span className="nav-item__label">{label}</span>
        {trailing}
      </AppLink>
    </li>
  );
}
