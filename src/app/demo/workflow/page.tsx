"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "place" | "placed" | "zoomed";

/* ------------------------------------------------------------------ bits */

function UpstartMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M3.5 13.5 12 5.8l8.5 7.7" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 18.2h8" fill="none" stroke="#0DBEA8" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

function NodeIcon({ id }: { id: string }) {
  const cls = "h-5 w-5";
  switch (id) {
    case "webform":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <rect x="5" y="4" width="14" height="17" rx="2" />
          <path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case "upstart":
      return <UpstartMark />;
    case "docprep":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
          <path d="M14 2v6h6M9 13h6M9 17h6" />
        </svg>
      );
    case "workspace":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
        </svg>
      );
    case "esign":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
          <path d="m14.5 4.5 5 5L8 21H3v-5L14.5 4.5Z" />
          <path d="m12.5 6.5 5 5" />
        </svg>
      );
    default:
      return null;
  }
}

function FlowCard({
  icon,
  title,
  sub,
  delay = 0,
  highlight,
}: {
  icon: string;
  title: string;
  sub: string;
  delay?: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`w-full rounded-xl border bg-white px-4 py-3.5 shadow-card animate-fade-up ${
        highlight ? "border-up-green/60 ring-2 ring-up-green/20" : "border-gray-200"
      }`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${highlight ? "bg-up-soft ring-up-green/30" : "bg-gray-50 ring-gray-100"}`}>
          <NodeIcon id={icon} />
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-gray-300">
          <circle cx="5" cy="12" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="19" cy="12" r="1.7" />
        </svg>
      </div>
      <p className="mt-2.5 text-sm font-semibold text-ds-ink">{title}</p>
      <p className="mt-0.5 text-xs text-ds-grayText">{sub}</p>
    </div>
  );
}

function Link({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative flex h-7 items-center justify-center">
      <div className="h-full w-px bg-gray-400" />
      <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-ds-blue animate-pop-check" style={{ animationDelay: `${delay}ms` }} />
    </div>
  );
}

/* -------------------------------------------------------------------- page */

export default function WorkflowDemoPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("place");
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-ds-canvas">
      {/* ------------------------------------------------- builder chrome */}
      <div className="flex items-center gap-3 bg-ds-ink px-4 py-2.5 text-white">
        <button
          onClick={() => router.push("/demo")}
          className="text-white/70 transition-colors hover:text-white"
          aria-label="Back to App Center"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <svg width="18" height="18" viewBox="0 0 28 28" aria-hidden>
          <rect width="28" height="28" rx="6" fill="#DC2C34" />
          <path d="M7 18.5c3.2-.8 4.8-5 5.6-9.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M10.5 17.5c3.8 1 7.5-.8 10.5-5.5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-semibold">New Workflow</p>
        {stage === "zoomed" && (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-ds-ink animate-fade-in">
            Published
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-white/50">
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
          <span className="btn pointer-events-none bg-ds-purple px-4 py-1.5 text-xs text-white">
            Review &amp; Publish
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------- canvas */}
      <div
        className="relative flex-1 overflow-y-auto px-6 py-10"
        style={{
          backgroundImage: "radial-gradient(#D8DCE1 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        {/* zoom control */}
        <div className="fixed bottom-6 left-6 z-20 flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-ds-ink shadow-card">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5M8 11h6" />
          </svg>
          <span className="tabular-nums">{stage === "zoomed" ? "72%" : "100%"}</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
          </svg>
        </div>

        <div
          className="mx-auto flex w-full max-w-[430px] min-w-[340px] origin-top flex-col items-center transition-transform duration-700 ease-out"
          style={{ transform: stage === "zoomed" ? "scale(0.82)" : "scale(1)" }}
        >
          {/* start */}
          <div className="flex items-center gap-1.5 rounded-md bg-ds-ink px-3 py-1.5 text-xs font-semibold text-white shadow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h10M18 18h2" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="16" cy="18" r="2" />
            </svg>
            Start
          </div>
          <Link />
          <FlowCard
            icon="webform"
            title="Collect Data from Web Forms"
            sub="Docusign Web Forms · Loan application"
          />

          {/* add-step slot */}
          {stage === "place" && (
            <>
              <Link />
              <div className="relative flex w-full flex-col items-center">
                <button
                  onClick={() => setPickerOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-md bg-ds-purple text-white shadow-lift transition hover:brightness-110"
                  aria-label="Add step"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
                    {pickerOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M12 5v14M5 12h14" />}
                  </svg>
                </button>
                <p className="mt-2 text-xs font-medium text-ds-grayText">
                  Add the next step after this.
                </p>

                {pickerOpen && (
                  <div className="absolute top-14 z-20 w-full max-w-sm overflow-hidden rounded-xl border border-ds-line bg-white shadow-lift animate-scale-in">
                    <div className="border-b border-ds-line p-2.5">
                      <input
                        autoFocus
                        className="w-full rounded-md border border-ds-purple px-3 py-2 text-sm focus:outline-none"
                        placeholder="Add the next step after this."
                      />
                    </div>
                    <button
                      onClick={() => {
                        setPickerOpen(false);
                        setStage("placed");
                      }}
                      className="flex w-full items-center gap-3 bg-up-soft/50 px-4 py-3 text-left transition-colors hover:bg-up-soft"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white ring-1 ring-up-green/30">
                        <UpstartMark size={20} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-ds-ink">
                          Credit Decision
                        </span>
                        <span className="block text-xs text-ds-grayText">
                          Upstart · AI decisions with risk-based pricing
                        </span>
                      </span>
                      <span className="ml-auto rounded-full bg-up-green px-2 py-0.5 text-[10px] font-bold text-white">
                        New app
                      </span>
                    </button>
                    {[
                      { t: "Verify Someone's Identity", d: "Docusign ID Verification", icon: "shield" },
                      { t: "Send an Email", d: "Send a customizable message", icon: "mail" },
                    ].map((o) => (
                      <div key={o.t} className="flex w-full items-center gap-3 px-4 py-3 text-left opacity-50">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-100">
                          {o.icon === "shield" ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                              <path d="M12 3l8 3v6c0 4.5-3.2 7.7-8 9-4.8-1.3-8-4.5-8-9V6l8-3Z" />
                              <path d="m9 12 2 2 4-4" />
                            </svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.8">
                              <rect x="3" y="5" width="18" height="14" rx="2" />
                              <path d="m4 7 8 6 8-6" />
                            </svg>
                          )}
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-ds-ink">{o.t}</span>
                          <span className="block text-xs text-ds-grayText">{o.d}</span>
                        </span>
                      </div>
                    ))}
                    <div className="flex w-full cursor-pointer items-center gap-3 border-t border-ds-line px-4 py-3">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      <span>
                        <span className="block text-sm font-bold text-ds-ink">Browse Apps</span>
                        <span className="block text-xs text-ds-grayText">
                          Add Apps to enhance your workflows
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* upstart step added */}
          {(stage === "placed" || stage === "zoomed") && (
            <>
              <Link />
              <FlowCard
                icon="upstart"
                title="Credit Decision"
                sub="Upstart · returns approval, APR & term options"
                highlight={stage === "placed"}
              />
            </>
          )}

          {/* zoom-out reveals the rest of the published flow */}
          {stage === "zoomed" && (
            <>
              {/* branch chips */}
              <div className="mt-3 flex w-full items-center justify-center gap-3 animate-fade-up" style={{ animationDelay: "150ms" }}>
                <span className="rounded-full border border-ds-green/40 bg-ds-greenSoft px-2.5 py-1 text-[10px] font-bold text-ds-green">
                  Rule met · Approved
                </span>
                <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-500">
                  Rule not met · Adverse action
                </span>
              </div>
              <Link delay={200} />
              <FlowCard icon="docprep" title="Generate Documents" sub="Docusign Document Prep · loan-type templates" delay={250} />
              <Link delay={350} />
              <FlowCard icon="workspace" title="Create Workspace" sub="Docusign Workspaces · borrower tasks" delay={400} />
              <Link delay={500} />
              <FlowCard icon="esign" title="Get Signatures" sub="Docusign eSignature + Click · 2 actions" delay={550} />
            </>
          )}
        </div>

        {/* guidance / launch banners */}
        {stage === "placed" && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-6">
            <div className="flex items-center gap-4 rounded-2xl border border-ds-line bg-white px-5 py-4 shadow-lift animate-fade-up">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-up-soft">
                <UpstartMark size={22} />
              </span>
              <div>
                <p className="text-sm font-bold text-ds-ink">
                  Credit Decision via Upstart — added
                </p>
                <p className="text-xs text-ds-grayText">
                  Zoom out to see the full published flow.
                </p>
              </div>
              <button
                className="btn bg-ds-purple px-5 py-2 text-xs text-white shadow hover:brightness-110"
                onClick={() => setStage("zoomed")}
              >
                Zoom out
              </button>
            </div>
          </div>
        )}

        {stage === "zoomed" && (
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center pb-6">
            <div
              className="flex flex-wrap items-center justify-center gap-4 rounded-2xl border border-ds-line bg-white px-5 py-4 shadow-lift animate-fade-up"
              style={{ animationDelay: "600ms" }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ds-greenSoft">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B7F3B" strokeWidth="2.6">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold text-ds-ink">
                  Consumer Loan Origination — live
                </p>
                <p className="text-xs text-ds-grayText">
                  See it working end-to-end in the bank portal.
                </p>
              </div>
              <button
                className="btn bg-up-green px-6 py-2.5 text-sm text-white shadow hover:bg-up-dark"
                onClick={() => router.push("/")}
              >
                Launch the bank portal
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
