import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { addSubmissionReviewComment, getSubmission, requestSubmissionReview, submitSubmissionReview, triggerValidation } from "../services/api";

const decisions = ["APPROVED", "CHANGES_REQUESTED", "REJECTED", "COMMENTED"];

export default function SubmissionDetail() {
  const { id } = useParams();
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState({ decision: "APPROVED", body: "" });
  const [comment, setComment] = useState({ reviewId: "", filePath: "", line: "1", body: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await getSubmission(id); setSubmission(result.data); }
    catch (err) { setError(err.message || "Could not load submission."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function act(operation) {
    setBusy(true); setError("");
    try { await operation(); await load(); }
    catch (err) { setError(err.message || "Action failed."); }
    finally { setBusy(false); }
  }

  const latestRun = submission?.validationRuns?.[0];
  return <main className="mx-auto min-h-screen max-w-5xl px-5 py-9 sm:px-8">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Workspace</Link>
    {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
    {loading ? <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-white p-8 text-slate-600"><LoaderCircle className="animate-spin"/>Loading submission…</div> : submission && <>
      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">{submission.repository.fullName}</p><h1 className="mt-2 text-3xl font-black">{submission.title}</h1><p className="mt-2 text-slate-600">{submission.sourceBranch} → {submission.targetBranch}</p><p className="mt-2 text-xs text-slate-500">Commit {submission.headCommitSha}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-900">{submission.status.replaceAll("_", " ")}</span><button onClick={load} className="rounded-lg border p-2" aria-label="Refresh submission"><RefreshCw size={16}/></button></div></div>{submission.description && <p className="mt-5 whitespace-pre-wrap border-t pt-5 text-sm leading-6 text-slate-700">{submission.description}</p>}<div className="mt-6 flex flex-wrap gap-2"><button disabled={busy || ["VALIDATING", "IN_REVIEW", "APPROVED", "REJECTED", "PUBLISHED"].includes(submission.status)} onClick={() => act(() => triggerValidation(id))} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Working…" : "Run governance checks"}</button><button disabled={busy || submission.status !== "SUBMITTED"} onClick={() => act(() => requestSubmissionReview(id))} className="rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-50">Request review</button></div></section>

      <section className="mt-7 rounded-2xl border bg-white p-6"><div className="flex items-center gap-2"><ShieldCheck size={20}/><h2 className="text-lg font-bold">Governance validation</h2></div>{latestRun ? <><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-sm">Latest run: <strong>{latestRun.status}</strong> · {latestRun.commitSha.slice(0, 12)}</span>{latestRun.status === "COMPLETED" ? <CheckCircle2 className="text-green-700" size={20}/> : latestRun.status === "FAILED" ? <CircleAlert className="text-red-700" size={20}/> : <LoaderCircle size={18} className="animate-spin"/>}</div>{latestRun.errorCode && <p className="mt-2 text-sm text-red-700">{latestRun.errorCode}</p>}<div className="mt-4 space-y-2">{latestRun.findings?.length ? latestRun.findings.map((finding) => <article key={finding.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><strong className="text-sm">{finding.title}</strong><span className="text-xs font-bold">{finding.severity} · {finding.tool}</span></div><p className="mt-1 text-xs text-slate-600">{finding.filePath || "Repository"}{finding.line ? `:${finding.line}` : ""}{finding.ruleId ? ` · ${finding.ruleId}` : ""}</p>{finding.description && <p className="mt-2 text-sm text-slate-600">{finding.description}</p>}</article>) : <p className="text-sm text-slate-500">No findings were recorded for this run.</p>}</div></> : <p className="mt-3 text-sm text-slate-500">No validation has been run for this submission.</p>}</section>

      {submission.status === "IN_REVIEW" && <section className="mt-7 rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Submit review decision</h2><form onSubmit={(event) => { event.preventDefault(); act(() => submitSubmissionReview(id, review.decision, review.body)); }} className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto]"><select value={review.decision} onChange={(event) => setReview({ ...review, decision: event.target.value })} className="rounded-lg border bg-white px-3 py-2"><option value="APPROVED">Approve</option><option value="CHANGES_REQUESTED">Request changes</option><option value="REJECTED">Reject</option><option value="COMMENTED">Comment</option></select><input value={review.body} onChange={(event) => setReview({ ...review, body: event.target.value })} placeholder="Reviewer note" className="rounded-lg border px-3 py-2"/><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Submit</button></form></section>}

      <section className="mt-7 rounded-2xl border bg-white p-6"><h2 className="text-lg font-bold">Review history</h2>{submission.reviews?.length ? <div className="mt-4 space-y-3">{submission.reviews.map((entry) => <article key={entry.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><strong>{entry.decision.replaceAll("_", " ")}</strong><span className="text-xs text-slate-500">{entry.reviewer.name || entry.reviewer.email} · {new Date(entry.createdAt).toLocaleString()}</span></div>{entry.body && <p className="mt-2 text-sm text-slate-700">{entry.body}</p>}{entry.comments?.map((item) => <p key={item.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">{item.filePath}{item.line ? `:${item.line}` : ""}: {item.body}</p>)}</article>)}</div> : <p className="mt-3 text-sm text-slate-500">No reviews yet.</p>}
        {submission.status === "IN_REVIEW" && submission.reviews?.length > 0 && <form onSubmit={(event) => { event.preventDefault(); act(async () => { await addSubmissionReviewComment(id, comment.reviewId || submission.reviews[0].id, { filePath: comment.filePath, line: Number(comment.line), body: comment.body }); setComment({ ...comment, body: "" }); }); }} className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-[1fr_100px_2fr_auto]"><input required value={comment.filePath} onChange={(event) => setComment({ ...comment, filePath: event.target.value })} placeholder="File path" className="rounded-lg border px-3 py-2"/><input required type="number" min="1" value={comment.line} onChange={(event) => setComment({ ...comment, line: event.target.value })} className="rounded-lg border px-3 py-2"/><input required value={comment.body} onChange={(event) => setComment({ ...comment, body: event.target.value })} placeholder="Inline comment" className="rounded-lg border px-3 py-2"/><button disabled={busy} className="rounded-lg border px-4 py-2 text-sm font-semibold">Comment</button></form>}
      </section>
    </>}
  </main>;
}
