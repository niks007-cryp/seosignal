import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  Menu,
  Minus,
  Plus,
} from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import {
  CURRENCIES,
  formatBudgetAmount,
  type CurrencyCode,
  type LeadInput,
  type QualificationReport,
  type QualificationSignal,
} from "../../../shared/qualification";

const analysisSteps = ["Reading the lead", "Website", "Requirement", "Fit", "Intent"];

const initialLead: LeadInput = {
  company: "",
  website: "",
  serviceRequired: "SEO strategy",
  budgetAmount: 5000,
  budgetCurrency: "USD",
  businessGoal: "Qualified leads",
  targetMarket: "",
  timeline: "",
  seoChallenge: "",
};

function ScoreDial({ score, qualification }: { score: number; qualification: string }) {
  const radius = 57;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const fitLabel = qualification === "HIGH" ? "HIGH FIT" : qualification === "MEDIUM" ? "MEDIUM FIT" : "LOW FIT";

  return (
    <div className="score-dial" aria-label={`Qualification score ${score} out of 100, ${fitLabel}`}>
      <svg viewBox="0 0 144 144" aria-hidden="true">
        <circle className="score-track" cx="72" cy="72" r={radius} />
        <circle className="score-progress" cx="72" cy="72" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
        <path className="score-tick" d="M72 7v7 M137 72h-7 M72 137v-7 M7 72h7" />
      </svg>
      <div className="score-value"><strong>{score}</strong><span>/100</span></div>
      <div className="score-level">{fitLabel}</div>
    </div>
  );
}

function SignalMark({ assessment }: { assessment: QualificationSignal["assessment"] }) {
  return <span className={`signal-mark signal-${assessment.toLowerCase()}`}><i />{assessment}</span>;
}

function QualificationSignalMap({ signals }: { signals: QualificationSignal[] }) {
  const points = [[50, 9], [72, 16], [89, 37], [86, 63], [67, 84], [37, 87], [14, 67], [11, 39], [29, 17], [50, 50]];
  const mapSignals = signals.slice(0, 10);

  return (
    <div className="signal-map-wrap" role="img" aria-label="Qualification signal map showing ten factors and their assessment states">
      <svg className="qualification-map" viewBox="0 0 100 100" aria-hidden="true">
        <circle className="map-outer" cx="50" cy="50" r="39" />
        <circle className="map-mid" cx="50" cy="50" r="25" />
        <circle className="map-inner" cx="50" cy="50" r="11" />
        {points.map(([x, y], index) => <line key={`line-${index}`} className="map-line" x1="50" y1="50" x2={x} y2={y} />)}
        <circle className="map-core" cx="50" cy="50" r="5" />
        {mapSignals.map((signal, index) => {
          const [x, y] = points[index];
          return <circle key={signal.signal} className={`map-node node-${signal.assessment.toLowerCase()}`} cx={x} cy={y} r="3.5" />;
        })}
      </svg>
      <div className="map-labels">
        {mapSignals.map((signal, index) => <span className={`map-label map-label-${index}`} key={signal.signal}><i className={`dot-${signal.assessment.toLowerCase()}`} />{signal.signal}</span>)}
      </div>
    </div>
  );
}

function FloatingNavigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 22);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  return (
    <nav className={`floating-nav-shell ${scrolled ? "is-scrolled" : ""}`} aria-label="SEOSignal navigation">
      <div className="floating-nav">
        <a className="brand nav-brand" href="#top" aria-label="SEOSignal home"><span className="brand-mark" />SEOSignal</a>
        <div className="nav-desktop-meta" aria-label="Product identity"><span>AI Lead Qualification</span><i /><span>Assessment Prototype</span></div>
        <a className="nav-qualify-link" href="#qualification-console"><span>Assess a new opportunity</span><ArrowDownRight size={15} /></a>
        <div className="nav-mobile-menu">
          <Sheet>
            <SheetTrigger asChild>
              <button className="mobile-nav-toggle" type="button" aria-label="Open navigation"><Menu size={18} /><span>Menu</span></button>
            </SheetTrigger>
            <SheetContent side="right" className="seosignal-mobile-sheet">
              <div className="mobile-sheet-brand"><span className="brand"><span className="brand-mark" />SEOSignal</span><span>AI Lead Qualification</span></div>
              <p className="mobile-sheet-label">Assessment Prototype</p>
              <SheetClose asChild>
                <a className="mobile-sheet-cta" href="#qualification-console"><span>Assess a new opportunity</span><ArrowDownRight size={17} /></a>
              </SheetClose>
              <p className="mobile-sheet-note">Fit → Signal → Action</p>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}

function Report({ lead, report }: { lead: LeadInput; report: QualificationReport }) {
  const generated = useMemo(() => new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date()), []);
  const monthlyBudget = `${formatBudgetAmount(lead.budgetAmount, lead.budgetCurrency)} / month`;

  return (
    <article className="report-shell" id="qualification-report" aria-labelledby="report-title">
      <header className="report-header">
        <div className="report-brand"><span className="brand-kicker">SEOSignal</span><span>LEAD QUALIFICATION</span><span className="report-status">ASSESSMENT COMPLETE</span></div>
        <div className="report-opening">
          <div className="company-block">
            <p className="report-eyebrow">LEAD SIGNAL</p><h2 id="report-title">{lead.company}</h2>
            <a href={lead.website} target="_blank" rel="noreferrer">{lead.website.replace(/^https?:\/\//, "")}<ExternalLink size={14} /></a>
            <p className="report-budget">Monthly budget <strong>{monthlyBudget}</strong></p><p className="generated-date">Generated {generated}</p>
          </div>
          <div className="report-score-block"><ScoreDial score={report.score} qualification={report.qualification} /><p>Assessment confidence <strong>{report.confidence.label}</strong></p></div>
        </div>
        <div className="report-conclusion"><div><p className="report-eyebrow">Assessment outcome</p><h3>{report.title}</h3></div><p>{report.rationale}</p></div>
      </header>
      <div className="report-body">
        <section className="executive-section section-rule" aria-labelledby="executive-title">
          <div className="section-heading"><p className="section-index">01</p><div><p className="section-kicker">Executive summary</p><h3 id="executive-title">Executive Signal</h3></div></div>
          <div className="executive-copy"><p>The assessment finds a defined commercial and service-fit signal, with the next conversation focused on the few variables that most affect scope and timing.</p><div className="signal-blocks">{report.executiveSummary.slice(0, 3).map((finding, index) => <div key={finding.title}><span>{["FIT", "COMMERCIAL", "INTENT"][index] || "CONTEXT"}</span><h4>{finding.title}</h4><p>{finding.body}</p></div>)}</div></div>
        </section>
        <section className="map-section section-rule" aria-labelledby="signal-map-title">
          <div className="section-heading"><p className="section-index">02</p><div><p className="section-kicker">Qualification signals</p><h3 id="signal-map-title">Signal Map</h3></div></div>
          <QualificationSignalMap signals={report.signals} /><p className="map-caption">Ten defined qualification factors are shown as an analytical field. Node treatment indicates whether evidence is strong, moderate, weak or unknown.</p>
        </section>
        <section className="factor-section section-rule" aria-labelledby="factor-title">
          <div className="section-heading"><p className="section-index">03</p><div><p className="section-kicker">Qualification Signals</p><h3 id="factor-title">Factor analysis</h3></div></div>
          <div className="table-wrap"><table><thead><tr><th>Signal</th><th>Assessment</th><th>Evidence</th></tr></thead><tbody>{report.signals.map((signal, index) => <tr key={signal.signal}><td><span className="row-number">{String(index + 1).padStart(2, "0")}</span>{signal.signal}</td><td><SignalMark assessment={signal.assessment} /></td><td>{signal.evidence}</td></tr>)}</tbody></table></div>
        </section>
        <section className="research-section section-rule">
          <div className="section-heading"><p className="section-index">04</p><div><p className="section-kicker">What we still need to know</p><h3>Signals still missing</h3></div></div>
          <div className="research-list">{report.missingInfo.length ? report.missingInfo.slice(0, 4).map((item, index) => <div key={`${item.title}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><h4>{item.title}</h4><p>{item.body}</p></div>) : <div><span>01</span><h4>Further validation</h4><p>The supplied brief is complete enough for the prototype assessment. Discovery remains appropriate before committing scope.</p></div>}</div>
        </section>
        <section className="next-move-section"><div><p className="section-index">05</p><p className="section-kicker">Recommended next move</p><h3>The next move</h3><h4>{report.recommendation.title}</h4><p>{report.recommendation.body}</p></div><ol>{report.recommendation.steps.slice(0, 3).map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol></section>
        <section className="methodology-section section-rule" aria-labelledby="methodology-title"><div className="section-heading"><p className="section-index">06</p><div><p className="section-kicker">Framework</p><h3 id="methodology-title">About this assessment</h3></div></div><div><p>{report.methodology}</p><p>{report.assumptions}</p><p className="validation-note">ToolImage can be used as a public real-world SaaS validation example when a website URL is supplied. This prototype makes no customer, endorsement, or private-information claim.</p></div></section>
      </div>
    </article>
  );
}

export default function Home() {
  const [lead, setLead] = useState<LeadInput>(initialLead);
  const [expanded, setExpanded] = useState(false);
  const [report, setReport] = useState<QualificationReport | null>(null);
  const [formError, setFormError] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [budgetFocused, setBudgetFocused] = useState(false);
  const analyze = trpc.qualification.analyze.useMutation();
  const websiteIsValid = /^https?:\/\/[^\s]+\.[^\s]+/i.test(lead.website);
  const completion = Math.round(([lead.company, lead.website, lead.serviceRequired, lead.budgetAmount > 0, lead.businessGoal].filter(Boolean).length / 5) * 100);
  const selectedCurrency = CURRENCIES.find((currency) => currency.code === lead.budgetCurrency) ?? CURRENCIES[0];
  const formattedBudgetInput = budgetFocused ? (lead.budgetAmount ? String(lead.budgetAmount) : "") : formatBudgetAmount(lead.budgetAmount, lead.budgetCurrency);
  const updateLead = <K extends keyof LeadInput>(key: K, value: LeadInput[K]) => setLead((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setReport(null);
    if (!lead.company.trim() || !lead.website.trim()) {
      setFormError("Please provide both Company and Website to begin the assessment.");
      return;
    }
    try {
      setReport(await analyze.mutateAsync(lead));
      window.setTimeout(() => document.getElementById("qualification-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 90);
    } catch {
      setFormError("Unable to complete the qualification right now. Please try again.");
    }
  }

  async function downloadReport() {
    const reportElement = document.getElementById("qualification-report");
    if (!reportElement) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(reportElement, { backgroundColor: "#ffffff", scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4", compress: true });
      const margin = 10;
      const width = 210 - margin * 2;
      const height = (canvas.height * width) / canvas.width;
      const printable = 297 - margin * 2;
      const source = canvas.toDataURL("image/png");
      let remaining = height;
      let offset = 0;
      pdf.setProperties({ title: `${lead.company} — SEOSignal Lead Intelligence`, subject: "Lead Qualification Report", author: "SEOSignal" });
      while (remaining > 0) {
        pdf.addImage(source, "PNG", margin, margin - offset, width, height, undefined, "FAST");
        remaining -= printable;
        offset += printable;
        if (remaining > 0) pdf.addPage();
      }
      pdf.save(`${lead.company.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "lead"}-seosignal-report.pdf`);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <main id="top">
      <section className="hero print-hidden" aria-labelledby="hero-title">
        <div className="hero-atmosphere" aria-hidden="true" />
        <div className="hero-visual" aria-hidden="true">
          <div className="signal-grid" />
          <svg viewBox="0 0 640 620" className="hero-signal-svg"><path d="M34 456C143 362 143 175 288 228s123 219 285 63" /><path d="M91 520C215 402 286 519 379 382S534 299 644 99" /><path d="M143 120c83 77 155 15 258 105s150 42 211 178" /><g className="signal-dots">{[[79, 456], [142, 365], [208, 271], [286, 228], [355, 278], [392, 411], [481, 393], [573, 295], [605, 168], [150, 120], [247, 157], [356, 226], [510, 354]].map(([cx, cy], index) => <circle key={index} cx={cx} cy={cy} r={index === 3 || index === 8 ? 7 : 3} />)}</g></svg>
          <div className="visual-label label-intent"><span>QUALIFIED INTENT</span><i /></div><div className="visual-label label-opportunity"><span>OPPORTUNITY</span><strong>HIGH FIT</strong></div><div className="visual-caption">ORGANIC SEARCH SIGNAL MAP <small>ABSTRACT VISUALIZATION</small></div>
        </div>
        <FloatingNavigation />
        <div className="hero-content container">
          <a className="hero-pill" href="#qualification-console"><span>AI-POWERED LEAD QUALIFICATION</span><ArrowUpRight size={14} /></a>
          <div className="hero-copy">
            <p className="hero-eyebrow">QUALIFIED ORGANIC GROWTH BEGINS WITH CLARITY</p>
            <h1 id="hero-title">Know which SEO leads<br />are worth pursuing.</h1>
            <p className="hero-description">Evaluate fit, intent, budget and business need — then turn the result into an actionable sales signal.</p>
            <div className="hero-actions"><a className="hero-primary" href="#qualification-console"><span>Assess a new opportunity</span><ArrowDownRight size={18} /></a><a className="hero-secondary" href="#qualification-console">Fit → Signal → Action</a></div>
          </div>
        </div>
      </section>
      <section className="tool-section print-hidden" id="qualification-console" aria-labelledby="form-title"><div className="container"><div className="console-frame"><div className="console-topline"><div><span className="console-kicker">NEW LEAD</span><span className="console-name">Qualification console</span></div><div className="completion-meter"><span>INPUT COMPLETENESS</span><i><b style={{ width: `${completion}%` }} /></i><strong>{completion}%</strong></div></div><div className="console-layout"><aside className="console-intro"><p className="section-index">01</p><h2 id="form-title">Qualify a new lead</h2><p>Give the assessment the signals it needs. The system will distinguish evidence from assumptions.</p><div className="console-note"><FileText size={16} /><span>Designed for informed outreach, not conversion prediction.</span></div></aside>
        <form className="lead-form" onSubmit={submit} noValidate>
          <fieldset><legend><span>Lead</span><strong>Who are we evaluating?</strong></legend><div className="form-grid two-up"><label>Company<input value={lead.company} onChange={(event) => updateLead("company", event.target.value)} placeholder="Northstar Analytics" autoComplete="organization" required /></label><label>Website<div className="field-with-status"><input value={lead.website} onChange={(event) => updateLead("website", event.target.value)} placeholder="https://company.com" type="url" autoComplete="url" required />{websiteIsValid && <Check size={15} aria-label="Valid website format" />}</div></label></div></fieldset>
          <fieldset><legend><span>Opportunity</span><strong>What are they looking for?</strong></legend><div className="form-grid"><label className="form-wide">Service required<select value={lead.serviceRequired} onChange={(event) => updateLead("serviceRequired", event.target.value as LeadInput["serviceRequired"])}><option>SEO strategy</option><option>Technical SEO</option><option>Content SEO</option><option>Enterprise SEO</option><option>SEO audit</option></select></label></div></fieldset>
          <fieldset><legend><span>Commercial signal</span><strong>What are they prepared to invest?</strong></legend><div className="form-grid"><label className="form-wide">Monthly budget<div className="currency-budget"><select value={lead.budgetCurrency} onChange={(event) => updateLead("budgetCurrency", event.target.value as CurrencyCode)} aria-label="Budget currency">{CURRENCIES.map((currency) => <option key={currency.code} value={currency.code}>{currency.code} — {currency.name} ({currency.symbol})</option>)}</select><input value={formattedBudgetInput} onFocus={() => setBudgetFocused(true)} onBlur={() => setBudgetFocused(false)} onChange={(event) => updateLead("budgetAmount", Number(event.target.value.replace(/[^\d]/g, "")) || 0)} inputMode="numeric" aria-label={`Monthly budget amount in ${selectedCurrency.name}`} /></div></label></div></fieldset>
          <fieldset><legend><span>Business intent</span><strong>What outcome are they trying to achieve?</strong></legend><div className="form-grid"><label className="form-wide">Goal<select value={lead.businessGoal} onChange={(event) => updateLead("businessGoal", event.target.value as LeadInput["businessGoal"])}><option>Qualified leads</option><option>Organic revenue</option><option>Market visibility</option><option>Technical health</option></select></label></div></fieldset>
          <button className="context-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "Collapse additional context" : "Expand additional context"}>{expanded ? <Minus size={15} /> : <Plus size={15} />}<span>+ Add more context</span><ChevronDown size={16} className={expanded ? "rotated" : ""} /></button>
          {expanded && <fieldset className="context-fields"><legend><span>Additional context</span><strong>What will improve the assessment?</strong></legend><div className="form-grid two-up"><label>Target market<input value={lead.targetMarket} onChange={(event) => updateLead("targetMarket", event.target.value)} placeholder="United States" /></label><label>Timeline<div className="timeline-options" role="group" aria-label="Timeline">{["0–30 days", "30–90 days", "3–6 months"].map((item) => <button type="button" className={lead.timeline === item ? "active" : ""} onClick={() => updateLead("timeline", lead.timeline === item ? "" : item)} key={item}>{item}</button>)}</div></label><label className="form-wide">Current SEO challenge<textarea value={lead.seoChallenge} onChange={(event) => updateLead("seoChallenge", event.target.value)} placeholder="What has changed, what is not working, or what needs to improve?" rows={3} /></label></div></fieldset>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-footer"><p>Assessment output is based only on supplied information and the stated qualification framework.</p><button className="primary-button" type="submit" disabled={analyze.isPending}>{analyze.isPending ? "Analyzing lead" : "Qualify Lead"}<ArrowDownRight size={17} /></button></div>
        </form>
      </div></div></div></section>
      {analyze.isPending && <section className="analysis-section print-hidden" aria-live="polite" aria-label="Lead analysis in progress"><div className="container analysis-inner"><div><p className="section-index">Analysis in progress</p><h2>Analyzing lead</h2><p>Evaluating fit, intent, budget and business need.</p></div><div className="analysis-tracker">{analysisSteps.map((step, index) => <div className={index === 0 ? "analysis-step complete" : "analysis-step"} key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></div>)}</div></div></section>}
      {report && <section className="result-section"><div className="container result-meta print-hidden"><p><span className="live-dot" />Lead intelligence ready</p><button onClick={downloadReport} className="download-button" disabled={isExporting}><Download size={16} />{isExporting ? "Preparing PDF" : "Download report"}</button></div><div className="container"><Report lead={lead} report={report} /></div></section>}
      <footer className="footer print-hidden"><div className="container"><span className="brand"><span className="brand-mark" />SEOSignal</span><p>AI-assisted inbound SEO lead qualification.</p><a href="#top">Back to top <ArrowUpRight size={15} /></a></div></footer>
    </main>
  );
}
