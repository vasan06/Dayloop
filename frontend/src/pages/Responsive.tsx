import { useState } from "react";
import {
  BatteryCharging,
  Check,
  CheckSquare,
  Flame,
  FolderKanban,
  LayoutDashboard,
  Moon,
  Plus,
  Repeat,
  Search,
  Sun,
  Wallet,
  Wifi,
} from "lucide-react";
import { Check22, PageHead, Progress, Seg } from "../components/ui";

type ViewMode = "both" | "mobile" | "tablet";

export default function Responsive() {
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [mockTheme, setMockTheme] = useState<"dark" | "light">("dark");

  const isDark = mockTheme === "dark";
  const mockBg = isDark ? "#0F1014" : "#F7F8FA";
  const mockCard = isDark ? "#171922" : "#FFFFFF";
  const mockLine = isDark ? "rgba(255,255,255,0.08)" : "#E4E6EB";
  const mockInk = isDark ? "#FFFFFF" : "#0F1014";
  const mockMute = isDark ? "#8A8F9E" : "#6E7381";
  const mockTrack = isDark ? "#212530" : "#EBEFF5";

  return (
    <>
      <PageHead
        title="Responsive Design Showcase"
        sub="Pixel-perfect layout adaptations engineered for mobile (390px), tablet (820px), and desktop"
      >
        <button
          className="btn sm"
          onClick={() => setMockTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {isDark ? <Sun className="ic" style={{ width: 14, height: 14 }} /> : <Moon className="ic" style={{ width: 14, height: 14 }} />}
          {isDark ? "Light preview" : "Dark preview"}
        </button>
      </PageHead>

      {/* Mode Switcher */}
      <div className="row wrap" style={{ gap: 12, marginBottom: 20 }}>
        <Seg
          value={viewMode}
          options={[
            ["both", "Side by Side"],
            ["mobile", "Mobile (390px)"],
            ["tablet", "Tablet (820px)"],
          ]}
          onChange={(v) => setViewMode(v as ViewMode)}
        />
        <span className="mute sm" style={{ marginLeft: "auto" }}>
          Interactive high-fidelity mockup frames
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 28,
          alignItems: "flex-start",
          justifyContent: "center",
          flexWrap: "wrap",
          padding: "24px 12px 48px",
          background: "radial-gradient(ellipse at center, rgba(43,76,255,0.06), transparent 70%)",
          borderRadius: 24,
        }}
      >
        {/* MOBILE FRAME (390px) */}
        {(viewMode === "both" || viewMode === "mobile") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div className="mono sm mute" style={{ marginBottom: 10 }}>
              Mobile Viewport · 390 × 844 px
            </div>

            <div
              style={{
                width: 390,
                height: 800,
                background: mockBg,
                color: mockInk,
                borderRadius: 48,
                boxShadow:
                  "0 25px 60px rgba(0,0,0,0.3), 0 0 0 10px #181A20, 0 0 0 12px var(--line)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Dynamic Island */}
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 28,
                  background: "#000000",
                  borderRadius: 20,
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0 12px",
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0a192f" }} />
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#08101a" }} />
              </div>

              {/* Status Bar */}
              <div
                style={{
                  height: 48,
                  padding: "12px 24px 0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 13,
                  fontWeight: 600,
                  zIndex: 10,
                }}
              >
                <span>9:41</span>
                <div className="row" style={{ gap: 6 }}>
                  <Wifi style={{ width: 14, height: 14 }} />
                  <BatteryCharging style={{ width: 15, height: 15 }} />
                </div>
              </div>

              {/* Mobile Header */}
              <div
                style={{
                  padding: "8px 18px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--t-butter)",
                      color: "#0F1014",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    DL
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: mockMute, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Good morning
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Alex Morgan</div>
                  </div>
                </div>

                <div className="row" style={{ gap: 6 }}>
                  <div
                    style={{
                      background: "rgba(242,154,31,0.15)",
                      color: "var(--amber)",
                      padding: "4px 8px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Flame style={{ width: 12, height: 12 }} />
                    14d
                  </div>
                </div>
              </div>

              {/* Mobile Scrollable Body */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "10px 16px 70px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Hero NBA Card */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #1f274a, #121524)",
                    borderRadius: 22,
                    padding: 16,
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--acc)" }}>
                    Next Best Action
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, margin: "6px 0 4px" }}>
                    Refactor OAuth Session Flow
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
                    High priority · Due in 3 hours
                  </div>
                  <button
                    className="btn pri sm"
                    style={{ width: "100%", justifyContent: "center", height: 34 }}
                  >
                    Start Now
                  </button>
                </div>

                {/* 2-Column Metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div
                    style={{
                      background: mockCard,
                      borderRadius: 18,
                      padding: 14,
                      border: `1px solid ${mockLine}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: mockMute }}>Habits Today</div>
                    <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0" }}>4 / 5</div>
                    <div style={{ height: 6, background: mockTrack, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: "80%", height: "100%", background: "var(--acc)", borderRadius: 99 }} />
                    </div>
                  </div>

                  <div
                    style={{
                      background: mockCard,
                      borderRadius: 18,
                      padding: 14,
                      border: `1px solid ${mockLine}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: mockMute }}>Month Net</div>
                    <div style={{ fontSize: 20, fontWeight: 700, margin: "4px 0", color: "var(--green)" }}>
                      +₹23.4k
                    </div>
                    <div style={{ fontSize: 10, color: mockMute }}>Budget: 62% spent</div>
                  </div>
                </div>

                {/* Scoped Task List */}
                <div
                  style={{
                    background: mockCard,
                    borderRadius: 20,
                    padding: 14,
                    border: `1px solid ${mockLine}`,
                  }}
                >
                  <div className="row sb" style={{ marginBottom: 10 }}>
                    <b style={{ fontSize: 13 }}>Focus Tasks</b>
                    <span style={{ fontSize: 11, color: mockMute }}>3 remaining</span>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="row" style={{ gap: 8, fontSize: 13 }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "2px solid var(--acc)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      />
                      <span style={{ flex: 1, fontWeight: 500 }}>Deploy staging cluster</span>
                      <span className="pill hi" style={{ fontSize: 9, padding: "2px 6px" }}>Hi</span>
                    </div>

                    <div className="row" style={{ gap: 8, fontSize: 13 }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          border: "2px solid var(--mute)",
                        }}
                      />
                      <span style={{ flex: 1, fontWeight: 500 }}>Review wireframes</span>
                      <span className="pill md" style={{ fontSize: 9, padding: "2px 6px" }}>Med</span>
                    </div>

                    <div className="row done" style={{ gap: 8, fontSize: 13 }}>
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          background: "var(--green)",
                          color: "#fff",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Check style={{ width: 10, height: 10 }} />
                      </div>
                      <span style={{ flex: 1, textDecoration: "line-through", color: mockMute }}>
                        Daily team standup
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile Bottom Navigation Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                  background: isDark ? "rgba(20,22,29,0.92)" : "rgba(255,255,255,0.92)",
                  backdropFilter: "blur(12px)",
                  borderTop: `1px solid ${mockLine}`,
                  display: "flex",
                  justifyContent: "space-around",
                  alignItems: "center",
                  padding: "0 10px",
                  zIndex: 20,
                }}
              >
                <div style={{ color: "var(--acc)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <LayoutDashboard style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 10, fontWeight: 600 }}>Home</span>
                </div>
                <div style={{ color: mockMute, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <CheckSquare style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 10 }}>Tasks</span>
                </div>
                <div style={{ color: mockMute, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Repeat style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 10 }}>Habits</span>
                </div>
                <div style={{ color: mockMute, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <Wallet style={{ width: 18, height: 18 }} />
                  <span style={{ fontSize: 10 }}>Finance</span>
                </div>
              </div>

              {/* iOS Home Indicator Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 4,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 120,
                  height: 4,
                  borderRadius: 99,
                  background: isDark ? "#ffffff" : "#000000",
                  opacity: 0.35,
                  zIndex: 25,
                }}
              />
            </div>
          </div>
        )}

        {/* TABLET FRAME (820px) */}
        {(viewMode === "both" || viewMode === "tablet") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "1 1 600px", maxWidth: 820 }}>
            <div className="mono sm mute" style={{ marginBottom: 10 }}>
              Tablet Viewport · 820 × 580 px (iPad Air Split-Rail)
            </div>

            <div
              style={{
                width: "100%",
                height: 580,
                background: mockBg,
                color: mockInk,
                borderRadius: 36,
                boxShadow:
                  "0 25px 60px rgba(0,0,0,0.3), 0 0 0 10px #181A20, 0 0 0 12px var(--line)",
                position: "relative",
                display: "flex",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {/* Tablet Compact Rail */}
              <div
                style={{
                  width: 68,
                  background: isDark ? "#12141A" : "#FFFFFF",
                  borderRight: `1px solid ${mockLine}`,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "16px 0",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: "var(--acc)",
                    display: "grid",
                    placeItems: "center",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 16,
                  }}
                >
                  D
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "var(--acc-soft)",
                      color: "var(--acc)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <LayoutDashboard style={{ width: 18, height: 18 }} />
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      color: mockMute,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <CheckSquare style={{ width: 18, height: 18 }} />
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      color: mockMute,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <FolderKanban style={{ width: 18, height: 18 }} />
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      color: mockMute,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Repeat style={{ width: 18, height: 18 }} />
                  </div>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      color: mockMute,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Wallet style={{ width: 18, height: 18 }} />
                  </div>
                </div>

                <div style={{ marginTop: "auto" }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--t-butter)",
                      color: "#0F1014",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    AM
                  </div>
                </div>
              </div>

              {/* Tablet Content Area */}
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  padding: "16px 20px",
                }}
              >
                {/* Tablet Top Bar */}
                <div
                  className="row sb"
                  style={{
                    paddingBottom: 14,
                    borderBottom: `1px solid ${mockLine}`,
                    marginBottom: 16,
                  }}
                >
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700 }}>Workspace Dashboard</span>
                    <span className="pill ok" style={{ fontSize: 10 }}>Sync active</span>
                  </div>

                  <div className="row" style={{ gap: 8 }}>
                    <div
                      style={{
                        background: mockCard,
                        border: `1px solid ${mockLine}`,
                        borderRadius: 99,
                        padding: "5px 12px",
                        fontSize: 12,
                        color: mockMute,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Search style={{ width: 13, height: 13 }} />
                      Quick search (⌘K)
                    </div>
                    <button className="btn pri sm" style={{ height: 30, fontSize: 12 }}>
                      <Plus className="ic" style={{ width: 13, height: 13 }} />
                      New
                    </button>
                  </div>
                </div>

                {/* Tablet Bento Grid (3-col / 2-col) */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1fr",
                    gap: 14,
                    flex: 1,
                  }}
                >
                  {/* Left Column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Tablet Hero NBA Card */}
                    <div
                      style={{
                        background: "linear-gradient(120deg, #182046, #0e1222)",
                        borderRadius: 20,
                        padding: 18,
                        color: "#fff",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <div className="row sb" style={{ marginBottom: 6 }}>
                        <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--acc)" }}>
                          Next Best Action
                        </span>
                        <span className="pill hi" style={{ fontSize: 9 }}>Urgent</span>
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, margin: "4px 0" }}>
                        DayLoop Prototype Validation & Polish
                      </div>
                      <p style={{ fontSize: 12, opacity: 0.8, margin: "0 0 14px" }}>
                        Verify detail views, budgets, transaction logs, and responsive layout fidelity.
                      </p>
                      <button className="btn pri sm" style={{ height: 32 }}>
                        Mark Complete
                      </button>
                    </div>

                    {/* Tablet Tasks List */}
                    <div
                      style={{
                        background: mockCard,
                        borderRadius: 20,
                        padding: 16,
                        border: `1px solid ${mockLine}`,
                        flex: 1,
                      }}
                    >
                      <div className="row sb" style={{ marginBottom: 12 }}>
                        <b style={{ fontSize: 14 }}>Active Tasks</b>
                        <span style={{ fontSize: 11, color: mockMute }}>4 pending</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div className="row" style={{ gap: 8, fontSize: 13 }}>
                          <Check22 on={false} label="T1" onClick={() => {}} />
                          <span style={{ flex: 1, fontWeight: 500 }}>Setup PostgreSQL replica</span>
                          <span className="pill hi" style={{ fontSize: 9 }}>Urgent</span>
                        </div>
                        <div className="row" style={{ gap: 8, fontSize: 13 }}>
                          <Check22 on={false} label="T2" onClick={() => {}} />
                          <span style={{ flex: 1, fontWeight: 500 }}>Refine finance Sankey diagram</span>
                          <span className="pill md" style={{ fontSize: 9 }}>Normal</span>
                        </div>
                        <div className="row done" style={{ gap: 8, fontSize: 13 }}>
                          <Check22 on={true} label="T3" onClick={() => {}} />
                          <span style={{ flex: 1, textDecoration: "line-through", color: mockMute }}>
                            Design AppStates component testbed
                          </span>
                          <span className="pill ok" style={{ fontSize: 9 }}>Done</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Tablet Finance Card */}
                    <div
                      style={{
                        background: mockCard,
                        borderRadius: 20,
                        padding: 16,
                        border: `1px solid ${mockLine}`,
                      }}
                    >
                      <div className="row sb" style={{ marginBottom: 8 }}>
                        <b style={{ fontSize: 14 }}>Monthly Cashflow</b>
                        <span className="pill ok" style={{ fontSize: 10 }}>Net positive</span>
                      </div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)", marginBottom: 8 }}>
                        +₹34,800
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div className="row sb sm mute" style={{ marginBottom: 4 }}>
                          <span>Budget Envelope Cap</span>
                          <span>68% spent</span>
                        </div>
                        <Progress value={68} />
                      </div>
                    </div>

                    {/* Tablet Habit Consistency Card */}
                    <div
                      style={{
                        background: mockCard,
                        borderRadius: 20,
                        padding: 16,
                        border: `1px solid ${mockLine}`,
                        flex: 1,
                      }}
                    >
                      <div className="row sb" style={{ marginBottom: 10 }}>
                        <b style={{ fontSize: 14 }}>Daily Habits Loop</b>
                        <span style={{ fontSize: 11, color: "var(--amber)", fontWeight: 600 }}>
                          🔥 14-day streak
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                          <div className="row sb sm" style={{ marginBottom: 4 }}>
                            <span>Morning Hydration & Walk</span>
                            <b style={{ color: "var(--green)" }}>Completed</b>
                          </div>
                          <Progress value={100} color="var(--green)" />
                        </div>

                        <div>
                          <div className="row sb sm" style={{ marginBottom: 4 }}>
                            <span>Read Technical RFCs (30m)</span>
                            <span className="mute">Pending</span>
                          </div>
                          <Progress value={45} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
