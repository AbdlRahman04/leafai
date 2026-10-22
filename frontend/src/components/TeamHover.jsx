import { useEffect, useId, useRef, useState } from "react";
import "./TeamHover.css";

const teamMembers = [
  { name: "Sara Alzaabi", id: "2022005404" },
  { name: "Abdlrahman Kamal", id: "2022005479" },
  { name: "Enad Alhebsi", id: "2021005243" },
  { name: "Haya Alnuaimi", id: "2022005558" },
  { name: "Heyam Hussein", id: "2022005600" },
  { name: "Shamma Alnuaimi", id: "2022005597" },
];

function TeamHover() {
  const [show, setShow] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!show) return;
    const dismiss = (event) => {
      if (!containerRef.current?.contains(event.target)) setShow(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [show]);

  return (
    <div
      ref={containerRef}
      className="team-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setShow(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && show) {
          event.stopPropagation();
          setShow(false);
          triggerRef.current?.focus();
        }
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="team-menu-trigger"
        aria-expanded={show}
        aria-controls={panelId}
        onClick={() => setShow((current) => !current)}
      >
        Project Team
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} className="team-menu-panel" hidden={!show}>
        <h2>Project team</h2>
        <ul>
          {teamMembers.map((member) => (
            <li key={member.id}>
              <span className="team-member-initial" aria-hidden="true">{member.name.charAt(0)}</span>
              <div><strong>{member.name}</strong><small>{member.id}</small></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default TeamHover;
