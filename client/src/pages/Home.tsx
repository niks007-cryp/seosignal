import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Minus,
  Plus,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import type { LeadInput, QualificationReport, QualificationSignal } from "../../../shared/qualification";

const analysisSteps = ["Reading the lead", "Website", "Requirement", "Fit", "Intent"];

const initialLead: LeadInput = {
  company: "",
  website: "",
  serviceRequired: "SEO strategy",
  monthlyBudget: "$2,000–$4,000",
  businessGoal: "Qualified leads",
  targetMarket: "",
  timeline: "",
  seoChallenge: "",
};

function ScoreDial({ score, qualification }: { score: number; qualification: string }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="score-dial" aria-label={`Qualification score ${score} out of 100, ${qualification}`}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle className="score-track" cx="66" cy="66" r={radius} />
        <circle className="score-progress" cx="66" cy="66" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="score-value"><strong>{score}</strong><span>/100</span></div>
      <div className="score-level">{qualification}</div>
    </div>
  );
}

function SignalMark({ assessment }: { assessment: QualificationSignal["assessment"] }) {
  return <span className={`signal-mark signal-${assessment.toLowerCase()}`}><i />{assessment}</span>;
}

function Report({ lead, report }: { lead: LeadInput; report: QualificationReport }) {
  const generated = useMemo(() => new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date()), []);
  return (
    <article className="report-shell" id="qualification-report" aria-labelledby="report-title">
      <header className="report-header">
        <div className="report-brand"><span className="brand-kicker">SEOSignal</span><span>LEAD QUALIFICATION</span></div>
        <div className="report-heading-block">
          <div>
            <p className="report-eyebrow">Qualification assessment</p>
            <h2 id="report-title">{lead.company}</h2>
            <a href={lead.website} target="_blank" rel="noreferrer">{lead.website.replace(/^https?:\/\//, "")}<ExternalLink size={14} /></a>
          </div>
          <p className="generated-date">Generated<br /><strong>{generated}</strong></p>
        </div>
        <div className="report-outcome">
          <ScoreDial score={report.score} qualification={report.qualification} />
          <div className="outcome-copy"><p className="report-eyebrow">Assessment outcome</p><h3>{report.title}</h3><p>{report.rationale}</p></div>
        </div>
      </header>

      <div className="report-body">
        <section className="summary-section section-rule" aria-labelledby="summary-title">
          <div className="section-intro"><p className="section-index">01</p><h3 id="summary-title">Executive Summary</h3></div>
          <div className="finding-grid">
            {report.executiveSummary.slice(0, 4).map((finding) => <div className="finding" key={finding.title}><h4>{finding.title}</h4><p>{finding.body}</p></div>)}
          </div>
        </section>

        <section className="signals-section section-rule" aria-labelledby="signals-title">
          <div className="section-intro"><p className="section-index">02</p><h3 id="signals-title">Qualification Signals</h3></div>
          <div className="table-wrap"><table><thead><tr><th>Signal</th><th>Assessment</th><th>Evidence</th></tr></thead><tbody>{report.signals.map((signal) => <tr key={signal.signal}><td>{signal.signal}</td><td><SignalMark assessment={signal.assessment} /></td><td>{signal.evidence}</td></tr>)}</tbody></table></div>
        </section>

        <section className="split-section section-rule">
          <div className="missing-section" aria-labelledby="missing-title">
            <div className="section-intro"><p className="section-index">03</p><h3 id="missing-title">What we still need to know</h3></div>
            <div className="numbered-insights">{report.missingInfo.length ? report.missingInfo.map((item, index) => <div key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h4>{item.title}</h4><p>{item.body}</p></div>) : <div><span>01</span><h4>Further validation</h4><p>The supplied brief is complete enough for the prototype assessment. Discovery remains the appropriate next step before committing scope.</p></div>}</div>
          </div>
          <aside className="confidence-card"><p className="report-eyebrow">Assessment confidence</p><strong>{report.confidence.label}</strong><p>{report.confidence.rationale}</p><div className="confidence-meter" role="img" aria-label={`Confidence based on ${report.confidence.evaluatedSignals} out of 10 qualification signals`}><span style={{ width: `${Math.max(15, report.confidence.evaluatedSignals * 10)}%` }} /></div><small>Based on {report.confidence.evaluatedSignals} of 10 qualification signals.</small></aside>
        </section>

        <section className="recommendation-section" aria-labelledby="recommendation-title">
          <div><p className="section-index">04</p><h3 id="recommendation-title">Recommended next move</h3><h4>{report.recommendation.title}</h4><p>{report.recommendation.body}</p></div>
          <ol>{report.recommendation.steps.slice(0, 3).map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, "0")}</span>{step}</li>)}</ol>
        </section>

        <section className="methodology-section section-rule" aria-labelledby="methodology-title">
          <div className="section-intro"><p className="section-index">05</p><h3 id="methodology-title">About this assessment</h3></div>
          <div><p>{report.methodology}</p><p>{report.assumptions}</p><p className="validation-note">ToolImage can be used as a public real-world SaaS validation example when a website URL is supplied. This prototype makes no customer, endorsement, or private-information claim.</p></div>
        </section>
      </div>
    </article>
  );
}

export default function Home() {
  const [lead, setLead] = useState<LeadInput>(initialLead);
  const [expanded, setExpanded] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [report, setReport] = useState<QualificationReport | null>(null);
  const [formError, setFormError] = useState("");
  const analyze = trpc.qualification.analyze.useMutation();

  useEffect(() => {
    if (!analyze.isPending) return;
    const timer = window.setInterval(() => setAnalysisStage((stage) => Math.min(stage + 1, analysisSteps.length - 1)), 550);
    return () => window.clearInterval(timer);
  }, [analyze.isPending]);

  const updateLead = (key: keyof LeadInput, value: string) => setLead((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setAnalysisStage(0);
    setReport(null);
    if (!lead.company.trim() || !lead.website.trim()) { setFormError("Please provide both Company and Website to begin the assessment."); return; }
    try { setReport(await analyze.mutateAsync(lead)); window.setTimeout(() => document.getElementById("qualification-report")?.scrollIntoView({ behavior: "smooth", block: "start" }), 90); }
    catch { setFormError("The assessment could not be completed. Please check the website format and try again."); }
  }

  return <main>
    <section className="hero print-hidden" aria-labelledby="hero-title">
      <div className="topbar container"><a className="brand" href="#top" aria-label="SEOSignal home"><span className="brand-mark" />SEOSignal</a><span className="topbar-subtitle">AI Lead Qualification</span><span className="prototype-label">Assessment Prototype</span></div>
      <div className="hero-grid container" id="top"><div className="hero-copy"><p className="hero-eyebrow">Qualified organic growth begins with clarity</p><h1 id="hero-title">Know which SEO leads are worth pursuing.</h1><p>Evaluate fit, intent, budget and business need — then turn the result into an actionable sales signal.</p></div><div className="signal-lockup" aria-label="Fit, Signal, Action"><span>Fit</span><i /><span>Signal</span><i /><span>Action</span></div></div>
    </section>

    <section className="tool-section print-hidden" aria-labelledby="form-title">
      <div className="container form-layout"><div className="tool-intro"><p className="section-index">01</p><h2>Qualify a new lead</h2><p>Start with the essentials. Add more context when you have it.</p><div className="tool-note"><FileText size={16} /><span>Designed for informed outreach, not conversion prediction.</span></div></div>
        <form className="lead-form" onSubmit={submit} noValidate>
          <div className="form-grid"><label>Company<input value={lead.company} onChange={(event) => updateLead("company", event.target.value)} placeholder="e.g. Northstar Analytics" autoComplete="organization" required /></label><label>Website<input value={lead.website} onChange={(event) => updateLead("website", event.target.value)} placeholder="https://company.com" type="url" autoComplete="url" required /></label><label>Service Required<select value={lead.serviceRequired} onChange={(event) => updateLead("serviceRequired", event.target.value)}><option>SEO strategy</option><option>Technical SEO</option><option>Content SEO</option><option>Enterprise SEO</option><option>SEO audit</option></select></label><label>Monthly Budget<select value={lead.monthlyBudget} onChange={(event) => updateLead("monthlyBudget", event.target.value)}><option>Under $2,000</option><option>$2,000–$4,000</option><option>$4,000–$8,000</option><option>$8,000+</option></select></label><label className="form-wide">Business Goal<select value={lead.businessGoal} onChange={(event) => updateLead("businessGoal", event.target.value)}><option>Qualified leads</option><option>Organic revenue</option><option>Market visibility</option><option>Technical health</option></select></label></div>
          <button className="context-toggle" type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-label={expanded ? "Collapse additional context" : "Expand additional context"}>{expanded ? <Minus size={15} /> : <Plus size={15} />}<span>+ Add more context</span><ChevronDown size={16} className={expanded ? "rotated" : ""} /></button>
          {expanded && <div className="form-grid context-fields"><label>Target Market<input value={lead.targetMarket} onChange={(event) => updateLead("targetMarket", event.target.value)} placeholder="e.g. United States" /></label><label>Timeline<input value={lead.timeline} onChange={(event) => updateLead("timeline", event.target.value)} placeholder="e.g. Within 90 days" /></label><label className="form-wide">Current SEO Challenge<textarea value={lead.seoChallenge} onChange={(event) => updateLead("seoChallenge", event.target.value)} placeholder="What has changed, what is not working, or what needs to improve?" rows={3} /></label></div>}
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="form-footer"><p>By continuing, you are creating an assessment based only on the information provided.</p><button className="primary-button" type="submit" disabled={analyze.isPending}>{analyze.isPending ? "Assessing lead" : "Qualify Lead"}<ArrowDownRight size={17} /></button></div>
        </form>
      </div>
    </section>

    {analyze.isPending && <section className="analysis-section print-hidden" aria-live="polite" aria-label="Lead analysis in progress"><div className="container analysis-inner"><div><p className="section-index">Analysis in progress</p><h2>Reading the lead</h2><p>The assessment is applying the defined capability and fit framework to the information supplied.</p></div><div className="analysis-tracker">{analysisSteps.map((step, index) => <div className={index <= analysisStage ? "analysis-step complete" : "analysis-step"} key={step}><span>{index < analysisStage ? <Check size={14} /> : String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></div>)}</div><div className="analysis-progress"><span style={{ width: `${((analysisStage + 1) / analysisSteps.length) * 100}%` }} /></div></div></section>}

    {report && <section className="result-section"><div className="container result-meta print-hidden"><p><span className="live-dot" />Assessment ready</p><button onClick={() => window.print()} className="download-button"><Download size={16} />Download report</button></div><div className="container"><Report lead={lead} report={report} /></div></section>}

    <footer className="footer print-hidden"><div className="container"><span className="brand"><span className="brand-mark" />SEOSignal</span><p>AI-assisted inbound SEO lead qualification.</p><a href="#top">Back to top <ArrowUpRight size={15} /></a></div></footer>
  </main>;
}
