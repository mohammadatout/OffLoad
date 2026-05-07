import React, { useState } from 'react';
import {
  Upload, Settings, Database, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Play, FileText, Layers,
  Phone, MapPin, Filter, Book, ArrowRight, Circle
} from 'lucide-react';

// =============================================================
// EntityMatch Pro — Redesigned Configuration Screen
// Aesthetic: working-tool, restrained, single-accent dark mode
// Inspired by: Linear app, Hex notebooks, Retool, terminal UIs
// =============================================================

export default function EntityMatchRedesign() {
  const [openSections, setOpenSections] = useState({ cleaning: true });
  const [activeTab, setActiveTab] = useState('normalization');

  const toggleSection = (key) =>
    setOpenSections((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-[#0B0D0E] text-[#E8E8E6] font-sans antialiased"
         style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ---------- TOP BAR ---------- */}
      <header className="border-b border-[#1F2224] sticky top-0 bg-[#0B0D0E]/95 backdrop-blur z-10">
        <div className="max-w-[1440px] mx-auto px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Brand */}
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-sm bg-[#2DD4BF] flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#0B0D0E]">E</span>
              </div>
              <span className="text-[13px] font-medium tracking-tight">EntityMatch Pro</span>
            </div>
            {/* Tabs */}
            <nav className="flex items-center gap-1">
              {[
                { id: 'offload', label: 'Offload' },
                { id: 'normalization', label: 'Normalization' },
                { id: 'matching', label: 'Matching Engine' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 h-7 text-[12px] rounded-md transition-colors ${
                    activeTab === t.id
                      ? 'bg-[#1A1D1F] text-[#E8E8E6]'
                      : 'text-[#8A8F93] hover:text-[#E8E8E6]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#8A8F93]">
            <span className="font-mono">1,228 rows</span>
            <span className="text-[#1F2224]">|</span>
            <span className="font-mono">6 cols</span>
            <span className="text-[#1F2224]">|</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF]" />
              <span className="font-mono">87 quality</span>
            </span>
          </div>
        </div>
      </header>

      {/* ---------- STEP INDICATOR ---------- */}
      <div className="border-b border-[#1F2224] bg-[#0B0D0E]">
        <div className="max-w-[1440px] mx-auto px-6 py-3 flex items-center gap-1">
          {[
            { n: 1, label: 'Upload', done: true },
            { n: 2, label: 'Configure', active: true },
            { n: 3, label: 'Process', done: false },
            { n: 4, label: 'Results', done: false },
          ].map((s, i) => (
            <React.Fragment key={s.n}>
              <div className={`flex items-center gap-2 px-2.5 h-7 rounded ${
                s.active ? 'bg-[#2DD4BF]/10 text-[#2DD4BF]' :
                s.done ? 'text-[#E8E8E6]' : 'text-[#5A5F63]'
              }`}>
                {s.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[9px] font-mono ${
                    s.active ? 'border-[#2DD4BF] bg-[#2DD4BF]/10' : 'border-[#3A3F43]'
                  }`}>{s.n}</span>
                )}
                <span className="text-[12px] font-medium">{s.label}</span>
              </div>
              {i < 3 && <ChevronRight className="w-3 h-3 text-[#3A3F43]" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ---------- BODY ---------- */}
      <main className="max-w-[1440px] mx-auto px-6 py-6 grid grid-cols-[320px_1fr] gap-6">

        {/* ===== LEFT: CONFIG PANEL ===== */}
        <aside className="space-y-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-mono uppercase tracking-wider text-[#8A8F93]">
              Configuration
            </h2>
            <button className="text-[11px] text-[#8A8F93] hover:text-[#E8E8E6]">Reset</button>
          </div>

          <ConfigSection
            icon={<Layers className="w-3.5 h-3.5" />}
            title="Cleaning &amp; Normalization"
            badge="3 active"
            open={openSections.cleaning}
            onToggle={() => toggleSection('cleaning')}
          >
            <Toggle label="Uppercase Conversion" hint="Excludes URLs & emails" />
            <Toggle label="Normalization &amp; Cleanup" hint="Punctuation, whitespace" on />
            <Toggle label="Remove Legal Entities" hint="LLC, Inc, Corp" on />
            <Toggle label="Replace Abbreviations" hint="Custom rules" on />
            <div className="pt-2 mt-2 border-t border-[#1F2224]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#5A5F63] mb-2">
                Columns to normalize
              </div>
              <div className="space-y-1">
                {['Csav Sales Group Name', 'SAVM Group Name'].map((c) => (
                  <label key={c} className="flex items-center gap-2 text-[12px] cursor-pointer">
                    <input type="checkbox" defaultChecked
                      className="w-3.5 h-3.5 rounded-sm border-[#3A3F43] bg-transparent accent-[#2DD4BF]" />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
          </ConfigSection>

          <ConfigSection icon={<FileText className="w-3.5 h-3.5" />} title="Parsing" />
          <ConfigSection icon={<Phone className="w-3.5 h-3.5" />} title="Phone, Website &amp; Links" />
          <ConfigSection icon={<MapPin className="w-3.5 h-3.5" />} title="City &amp; State Validation" />
          <ConfigSection icon={<Filter className="w-3.5 h-3.5" />} title="Deduplication Strategy" />
          <ConfigSection icon={<Book className="w-3.5 h-3.5" />} title="Dictionaries &amp; Lists" />

          <button className="w-full mt-4 h-9 rounded-md bg-[#2DD4BF] text-[#0B0D0E] text-[12px] font-medium flex items-center justify-center gap-2 hover:bg-[#26B8A3] transition-colors">
            <Play className="w-3.5 h-3.5 fill-current" />
            Run Normalization
          </button>
        </aside>

        {/* ===== RIGHT: WORK AREA ===== */}
        <section className="space-y-4">

          {/* Required action callout */}
          <div className="flex items-start gap-3 px-4 py-3 rounded-md border border-[#3A2F1A] bg-[#1F1A0E]">
            <AlertCircle className="w-4 h-4 text-[#E5A23B] mt-0.5 shrink-0" />
            <div className="flex-1">
              <div className="text-[12px] text-[#E8E8E6]">
                Select the <span className="font-medium">main entity field</span> to enable processing.
              </div>
              <div className="text-[11px] text-[#8A8F93] mt-0.5">
                We suggest <span className="font-mono text-[#E5A23B]">Csav Sales Group Name</span>.
              </div>
            </div>
            <button className="text-[11px] text-[#E5A23B] hover:underline shrink-0">
              Use suggestion →
            </button>
          </div>

          {/* Quality + preview side by side */}
          <div className="grid grid-cols-[260px_1fr] gap-4">

            {/* Quality score */}
            <div className="border border-[#1F2224] rounded-md p-4 bg-[#0F1112]">
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F93] mb-3">
                Quality Score
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-[40px] font-medium tracking-tight leading-none">87</span>
                <span className="text-[11px] text-[#8A8F93] font-mono">/100</span>
              </div>
              <div className="space-y-2">
                <Bar label="Completeness" value={100} />
                <Bar label="Validity" value={100} />
                <Bar label="Consistency" value={100} />
                <Bar label="Uniqueness" value={36} warn />
              </div>
              <button className="text-[11px] text-[#8A8F93] hover:text-[#E8E8E6] mt-3 flex items-center gap-1">
                Column breakdown <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Data preview */}
            <div className="border border-[#1F2224] rounded-md bg-[#0F1112] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-[#1F2224] flex items-center justify-between">
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#8A8F93]">
                  Input preview · 5 of 1,228
                </div>
                <button className="text-[11px] text-[#8A8F93] hover:text-[#E8E8E6]">View all</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono">
                  <thead>
                    <tr className="text-[#5A5F63] border-b border-[#1F2224]">
                      {['Csav Sales Group', 'SAVM ID', 'SAVM Group', 'Sheet WF', 'Lighthouse'].map((h) => (
                        <th key={h} className="text-left font-normal px-3 py-2 whitespace-nowrap uppercase tracking-wider text-[10px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-[#E8E8E6]">
                    {[
                      ['Adobe Inc', '203779756', 'Adobe United States', 'Adobe Inc', 'P/ WG'],
                      ['Adobe Inc', '203812689', 'Adobe India', 'Adobe Inc', 'P/ WG'],
                      ['Adobe Inc', '203835245', 'Adobe Ireland', 'Adobe Inc', 'P/ WG'],
                      ['Adobe Inc', '203847994', 'Adobe Canada', 'Adobe Inc', 'P/ WG'],
                      ['Adobe Inc', '205374378', 'Adobe', 'Adobe Inc', 'P/ WG'],
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-[#15181A] last:border-0 hover:bg-[#15181A]">
                        {row.map((c, j) => (
                          <td key={j} className="px-3 py-2 whitespace-nowrap">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer hint */}
          <div className="text-[11px] text-[#5A5F63] flex items-center gap-2">
            <Circle className="w-2 h-2 fill-current" />
            Configuration auto-saves. Click <span className="font-mono text-[#8A8F93]">Run Normalization</span> when ready.
          </div>
        </section>
      </main>
    </div>
  );
}

// =============================================================
// Subcomponents
// =============================================================

function ConfigSection({ icon, title, badge, open, onToggle, children }) {
  const isInteractive = !!onToggle;
  return (
    <div className="border border-[#1F2224] rounded-md bg-[#0F1112] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 h-9 flex items-center justify-between text-left hover:bg-[#15181A] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[#8A8F93]">{icon}</span>
          <span className="text-[12px] font-medium" dangerouslySetInnerHTML={{ __html: title }} />
          {badge && (
            <span className="text-[10px] font-mono text-[#2DD4BF] bg-[#2DD4BF]/10 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          )}
        </div>
        {isInteractive && (
          open ? <ChevronDown className="w-3.5 h-3.5 text-[#5A5F63]" />
               : <ChevronRight className="w-3.5 h-3.5 text-[#5A5F63]" />
        )}
        {!isInteractive && <ChevronRight className="w-3.5 h-3.5 text-[#5A5F63]" />}
      </button>
      {open && children && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-[#1F2224]">
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, hint, on }) {
  const [checked, setChecked] = useState(!!on);
  return (
    <button
      onClick={() => setChecked(!checked)}
      className="w-full flex items-center justify-between gap-3 py-1 text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px]" dangerouslySetInnerHTML={{ __html: label }} />
        {hint && <div className="text-[10px] text-[#5A5F63] mt-0.5">{hint}</div>}
      </div>
      <div className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[#2DD4BF]' : 'bg-[#2A2E31]'
      }`}>
        <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-3.5' : 'translate-x-0.5'
        }`} />
      </div>
    </button>
  );
}

function Bar({ label, value, warn }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="text-[#8A8F93] font-mono uppercase tracking-wider">{label}</span>
        <span className={`font-mono ${warn ? 'text-[#E5A23B]' : 'text-[#E8E8E6]'}`}>{value}%</span>
      </div>
      <div className="h-1 bg-[#1F2224] rounded-full overflow-hidden">
        <div
          className={`h-full ${warn ? 'bg-[#E5A23B]' : 'bg-[#2DD4BF]'}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
