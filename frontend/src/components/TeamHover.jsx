import { useState } from "react";

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

  return (
    <div
      style={{
        position: "absolute",
        top: "28px",
        right: "36px",
        zIndex: 1000,
      }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {/* Trigger Pill */}
      <div
        style={{
          cursor: "pointer",
          fontWeight: 600,
          fontSize: "13px",
          letterSpacing: "0.5px",
          fontFamily: "'Inter', sans-serif",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          color: "rgba(255,255,255,0.85)",
          padding: "8px 18px",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.15)",
          transition: "all 0.3s ease",
          boxShadow: show
            ? "0 8px 30px rgba(0,0,0,0.15)"
            : "0 4px 12px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        Project Team
      </div>

      {/* Dropdown Card */}
      <div
        style={{
          marginTop: "10px",
          background: "rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          padding: show ? "24px" : "0 24px",
          maxHeight: show ? "400px" : "0",
          opacity: show ? 1 : 0,
          borderRadius: "18px",
          border: show ? "1px solid rgba(255,255,255,0.12)" : "1px solid transparent",
          boxShadow: show ? "0 20px 60px rgba(0,0,0,0.2)" : "none",
          width: "280px",
          overflow: "hidden",
          transition: "all 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          pointerEvents: show ? "auto" : "none",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "1.2px",
            color: "rgba(255,255,255,0.4)",
            marginBottom: "16px",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          Team Members
        </div>
        {teamMembers.map((member, index) => (
          <div
            key={member.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "8px 0",
              borderBottom:
                index < teamMembers.length - 1
                  ? "1px solid rgba(255,255,255,0.06)"
                  : "none",
              fontFamily: "'Inter', sans-serif",
              opacity: show ? 1 : 0,
              transform: show ? "translateX(0)" : "translateX(10px)",
              transition: `all 0.3s ${0.05 * index}s ease`,
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: `linear-gradient(135deg, hsl(${130 + index * 15}, 45%, 45%), hsl(${140 + index * 15}, 50%, 55%))`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {member.name.charAt(0)}
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                {member.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.4)",
                  marginTop: "1px",
                }}
              >
                {member.id}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamHover;
