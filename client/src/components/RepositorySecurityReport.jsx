import { useEffect, useState } from "react";
import { Download, FileText, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { requestHakiBackend, saveSecurityReportFile } from "../services/api";

const REPORT_PATH = "HAKI_SECURITY_REPORT.md";
const styles = { critical: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800", medium: "bg-yellow-100 text-yellow-800", low: "bg-blue-100 text-blue-800" };

export default function RepositorySecurityReport({ repositoryId, repositoryName, files, onReportSaved }) {
  const [report, setReport] = useState(null);
  const [scanError, setScanError] = useState("");
  const [summary, setSummary] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [scanning, setScanning] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setScanning(true);
    setReport(null);
    setScanError("");
    const sourceFiles = files.filter((file) => file.path !== REPORT_PATH);
    requestHakiBackend("scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ files: sourceFiles.map(({ path, content, encoding }) => ({ path, content, encoding })) }),
      signal: controller.signal,
    }).then((result) => setReport(result.report)).catch((error) => { if (error.name !== "AbortError") setScanError(error.message || "The server could not scan this repository."); })
      .finally(() => { if (!controller.signal.aborted) setScanning(false); });
    return () => controller.abort();
  }, [files]);

  async function generateReportFile() {
    setSaving(true);
    setSaveMessage("");
    setScanError("");
    try {
      const sourceFiles = files.filter((file) => file.path !== REPORT_PATH);
      const result = await requestHakiBackend("scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: sourceFiles.map(({ path, content, encoding }) => ({ path, content, encoding })) }),
      });
      setReport(result.report);
      let aiSummary = "";
      try {
        const review = await requestHakiBackend("review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repository: repositoryName, findings: result.report.findings.slice(0, 80) }),
        });
        aiSummary = review.summary || "";
        setSummary(aiSummary);
        setReviewError("");
      } catch (error) {
        setReviewError("The security report was saved without an AI summary: " + (error.message || "AI review unavailable."));
      }
      const saved = await saveSecurityReportFile(repositoryId, repositoryName, result.report, { summary: aiSummary || summary });
      onReportSaved?.(saved.file);
      setSaveMessage("Report generated and saved in this repository as " + REPORT_PATH + ".");
    } catch (error) {
      setScanError(error.message || "HAKI could not generate the report file.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewWithGemini() {
    if (!report) return;
    setReviewing(true); setReviewError(""); setSummary("");
    try {
      const result = await requestHakiBackend("review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository: repositoryName, findings: report.findings.slice(0, 80) }) });
      setSummary(result.summary);
    } catch (error) { setReviewError(error.message || "Gemini review is unavailable."); }
    finally { setReviewing(false); }
  }

  function download() {
    if (!report) return;
    const rows = report.findings.length ? report.findings.map((item) => "| " + item.severity.toUpperCase() + " | " + item.title + " | " + item.path + (item.line ? ":" + item.line : "") + " | " + item.recommendation + " |").join("\n") : "| — | No matched patterns | — | No issues matched the configured checks. |";
    const markdown = "# HAKI Security and Governance Report\n\nRepository: **" + repositoryName + "**\n\nGenerated: " + new Date(report.scannedAt).toLocaleString() + "\n\nFiles scanned: " + report.scannedFiles + "\n\nCritical: " + report.counts.critical + " · High: " + report.counts.high + " · Medium: " + report.counts.medium + " · Low: " + report.counts.low + "\n\n" + (summary ? "## HAKI AI review\n\n" + summary + "\n\n" : "") + "## Findings\n\n| Severity | Finding | Location | Recommendation |\n|---|---|---|---|\n" + rows + "\n\nThis automated report checks configured patterns and is not proof that the code is correct or safe. A senior developer should review the findings and code. Secret values are hidden.\n";
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = repositoryName + "-haki-security-report.md"; link.click(); URL.revokeObjectURL(url);
  }

  return <section className="mb-6 rounded-2xl border border-[#E8D9DE] bg-white p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div><div className="flex items-center gap-2"><ShieldCheck className="text-[#7187AC]" size={21}/><h2 className="text-lg font-bold">Security &amp; governance report</h2></div><p className="mt-1 text-sm text-[#827C89]">{scanning ? "Scanning repository on HAKI server…" : scanError || ("Server checked " + (report?.scannedFiles || 0) + " text files. Secret values stay hidden.")}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={generateReportFile} disabled={!repositoryId || scanning || saving} className="inline-flex items-center gap-2 rounded-lg bg-[#7187AC] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin"/> : <FileText size={16}/>} {saving ? "Generating…" : "Generate report file"}</button>
        <button type="button" onClick={reviewWithGemini} disabled={!report || reviewing || scanning} className="inline-flex items-center gap-2 rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm font-semibold disabled:opacity-50">{reviewing ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16}/>} {reviewing ? "Reviewing…" : "HAKI AI review"}</button>
        <button type="button" onClick={download} disabled={!report} className="inline-flex items-center gap-2 rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm font-semibold disabled:opacity-50"><Download size={16}/> Download</button>
      </div>
    </div>
    {saveMessage && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saveMessage}</p>}
    {report && <><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(report.counts).map(([level, count]) => <div key={level} className="rounded-xl bg-[#FFF8F1] p-3"><p className="text-xs capitalize text-[#827C89]">{level}</p><p className="text-2xl font-bold">{count}</p></div>)}</div>{summary && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-[#F2F5FB] p-4 text-sm leading-6">{summary}</p>}{reviewError && <p role="alert" className="mt-3 text-sm text-[#A96060]">{reviewError}</p>}<div className="mt-4 space-y-2">{report.findings.map((item) => <article key={item.id} className="rounded-xl border border-[#E8D9DE] p-4"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${styles[item.severity]}`}>{item.severity}</span><strong className="text-sm">{item.title}</strong><span className="text-xs text-[#958F9B]">{item.path}{item.line ? ":" + item.line : ""}</span></div><p className="mt-2 text-sm text-[#706B79]">{item.message}</p><p className="mt-2 text-sm text-[#514D5A]"><strong>Fix:</strong> {item.recommendation}</p></article>)}</div></>}
    <p className="mt-4 text-xs leading-5 text-[#958F9B]">A report file is saved in this repository after every commit. You can also generate it manually. HAKI checks configured patterns; a senior developer should review the code. Gemini receives finding metadata only, never repository source code or secret values.</p>
  </section>;
}
