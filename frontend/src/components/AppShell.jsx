import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import TeamHover from "./TeamHover";
import "./AppShell.css";

const navigationItems = [
  {
    to: "/",
    label: "Home",
    end: true,
    icon: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    to: "/choose",
    label: "New Scan",
    icon: <><path d="M12 5v14M5 12h14" /><rect x="3" y="3" width="18" height="18" rx="3" /></>,
  },
  {
    to: "/chat",
    label: "Chat",
    icon: <><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.4 8.4 0 0 1-3.2-.6L4 20l1.6-4A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z" /><path d="M8 11h.01M12 11h.01M16 11h.01" /></>,
  },
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /><path d="m4 7 6-4 6 3 6-4" /></>,
  },
  {
    to: "/reports",
    label: "Reports",
    icon: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v4h4M9 12h6M9 16h6" /></>,
  },
];

function AppShell() {
  const { pathname } = useLocation();
  const toggleRef = useRef(null);
  const sidebarRef = useRef(null);
  const closeRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [autoCompact, setAutoCompact] = useState(() => (
    typeof window !== "undefined"
      && window.matchMedia("(min-width: 769px) and (max-width: 1199px)").matches
  ));
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const compactQuery = window.matchMedia("(min-width: 769px) and (max-width: 1199px)");
    const updateCompactMode = (event) => setAutoCompact(event.matches);
    compactQuery.addEventListener("change", updateCompactMode);
    return () => compactQuery.removeEventListener("change", updateCompactMode);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const toggle = toggleRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());
    const desktopQuery = window.matchMedia("(min-width: 769px)");
    const closeOnDesktop = (event) => {
      if (event.matches) setMobileOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
      if (event.key !== "Tab") return;
      const controls = [...sidebarRef.current.querySelectorAll("a, button")]
        .filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!sidebarRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    desktopQuery.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      desktopQuery.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("keydown", handleKeyDown);
      if (toggle?.getClientRects().length) toggle.focus();
    };
  }, [mobileOpen]);

  return (
    <div className={`app-shell${collapsed || autoCompact ? " app-shell-collapsed" : ""}`}>
      <a className="skip-link" href="#main-content" inert={mobileOpen}>Skip to content</a>
      <header className="app-mobile-header" inert={mobileOpen}>
        <button
          ref={toggleRef}
          className="app-shell-mobile-toggle"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-controls="primary-navigation"
          aria-expanded={mobileOpen}
        >
          <span /><span /><span />
        </button>
        <NavLink to="/" className="app-mobile-brand" aria-label="LeafAI home">LeafAI</NavLink>
        {pathname === "/" && <TeamHover />}
      </header>

      {mobileOpen && (
        <button
          className="app-shell-backdrop"
          tabIndex={-1}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside ref={sidebarRef} id="primary-navigation" className={`app-sidebar${mobileOpen ? " app-sidebar-mobile-open" : ""}`} aria-label="Primary navigation" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined}>
        <div className="app-sidebar-brand">
          <span className="app-sidebar-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 120 120" fill="none">
              <path d="M92 18C57 21 28 39 25 69c-2 19 11 31 29 29 29-3 37-31 38-80Z" fill="currentColor" />
              <path d="M29 91c16-20 31-34 57-57M46 76l-2-18M59 63l-1-17M39 82l-15 1" stroke="#16451d" strokeOpacity=".72" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
          <span className="app-sidebar-brand-name">LeafAI</span>
          <button ref={closeRef} className="app-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
          </button>
        </div>

        <nav className="app-sidebar-nav">
          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `app-sidebar-link${isActive ? " app-sidebar-link-active" : ""}`}
              title={collapsed ? item.label : undefined}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          className="app-sidebar-collapse"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">{collapsed ? "→" : "←"}</span>
          <span className="app-sidebar-collapse-label">Collapse menu</span>
        </button>
      </aside>

      <main className="app-shell-main" id="main-content" tabIndex="-1" inert={mobileOpen}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppShell;
