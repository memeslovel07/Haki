import { Fragment, useCallback, useEffect, useState } from "react";
import {
  addSubmissionReviewComment,
  createSubmission,
  createGitHubInstallState,
  getGovernanceRepositories,
  getRepositoryBranches,
  getBranchCommits,
  getSubmissionReviews,
  getSubmissionDiff,
  getSubmissionValidation,
  getSubmissions,
  requestSubmissionReview,
  submitSubmissionReview,
  validateSubmission,
} from "../services/api";

const fieldClass = "w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-sm outline-none focus:border-[#A9B9D3]";

function sideBySideRows(patch = "") {
  let oldLine = 0;
  let newLine = 0;
  return patch.split("\n").flatMap((line, index) => {
    const hunk = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { oldLine = Number(hunk[1]); newLine = Number(hunk[2]); return []; }
    if (line.startsWith("\\ No newline")) return [];
    if (line.startsWith("+") && !line.startsWith("+++")) return [{ key: index, kind: "add", oldLine: null, newLine: newLine++, oldText: "", newText: line.slice(1) }];
    if (line.startsWith("-") && !line.startsWith("---")) return [{ key: index, kind: "remove", oldLine: oldLine++, newLine: null, oldText: line.slice(1), newText: "" }];
    const content = line.startsWith(" ") ? line.slice(1) : line;
    return [{ key: index, kind: "context", oldLine: oldLine++, newLine: newLine++, oldText: content, newText: content }];
  });
}

export default function GovernancePage() {
  const [repositories, setRepositories] = useState([]);
  const [branches, setBranches] = useState([]);
  const [sourceCommits, setSourceCommits] = useState([]);
  const [targetCommits, setTargetCommits] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [form, setForm] = useState({ repositoryId: "", title: "", description: "", sourceBranch: "feature", targetBranch: "main", baseCommitSha: "", headCommitSha: "" });
  const [expandedId, setExpandedId] = useState("");
  const [validation, setValidation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [diff, setDiff] = useState(null);
  const [diffSubmissionId, setDiffSubmissionId] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState("");
  const [fileFilter, setFileFilter] = useState("");
  const [comment, setComment] = useState({ reviewId: "", filePath: "", line: "1", body: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get("installation") === "success" ? "GitHub App connected. Its repositories are ready for code governance." : "");
  const [error, setError] = useState(() => ["failed", "expired"].includes(new URLSearchParams(window.location.search).get("installation")) ? "GitHub App installation could not be completed. Start again and finish within 10 minutes." : "");
  const canWrite = repositories.find((repo) => repo.id === form.repositoryId)?.memberRole !== "REVIEWER";

  const loadData = useCallback(async () => {
    try {
      const [repoData, submissionData] = await Promise.all([getGovernanceRepositories(), getSubmissions()]);
      setError("");
      setRepositories(repoData);
      setSubmissions(submissionData);
      setForm((current) => ({ ...current, repositoryId: current.repositoryId || repoData[0]?.id || "" }));
    } catch (loadError) {
      setError(loadError.message || "Unable to load code governance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const installation = new URLSearchParams(window.location.search).get("installation");
    if (installation) window.history.replaceState({}, "", window.location.pathname);
    queueMicrotask(() => { void loadData(); });
  }, [loadData]);

  useEffect(() => {
    if (!form.repositoryId) return;
    let active = true;
    getRepositoryBranches(form.repositoryId).then((items) => {
      if (!active) return;
      setBranches(items);
      setForm((current) => {
        const defaultBranch = repositories.find((repo) => repo.id === current.repositoryId)?.defaultBranch || items[0]?.name || "main";
        const targetBranch = items.some((item) => item.name === current.targetBranch) ? current.targetBranch : defaultBranch;
        const sourceBranch = items.some((item) => item.name === current.sourceBranch) ? current.sourceBranch : (items.find((item) => item.name !== targetBranch)?.name || targetBranch);
        return { ...current, sourceBranch, targetBranch };
      });
    }).catch((loadError) => { if (active) setError(loadError.message || "Unable to load repository branches."); });
    return () => { active = false; };
  }, [form.repositoryId, repositories]);

  useEffect(() => {
    if (!form.repositoryId || !form.sourceBranch) return;
    let active = true;
    getBranchCommits(form.repositoryId, form.sourceBranch).then((items) => {
      if (!active) return;
      setSourceCommits(items);
      setForm((current) => ({ ...current, headCommitSha: current.headCommitSha && items.some((item) => item.sha.startsWith(current.headCommitSha)) ? current.headCommitSha : items[0]?.sha || "" }));
    }).catch((loadError) => { if (active) setError(loadError.message || "Unable to load source commits."); });
    return () => { active = false; };
  }, [form.repositoryId, form.sourceBranch]);

  useEffect(() => {
    if (!form.repositoryId || !form.targetBranch) return;
    let active = true;
    getBranchCommits(form.repositoryId, form.targetBranch).then((items) => {
      if (!active) return;
      setTargetCommits(items);
      setForm((current) => ({ ...current, baseCommitSha: current.baseCommitSha && items.some((item) => item.sha.startsWith(current.baseCommitSha)) ? current.baseCommitSha : items[0]?.sha || "" }));
    }).catch((loadError) => { if (active) setError(loadError.message || "Unable to load target commits."); });
    return () => { active = false; };
  }, [form.repositoryId, form.targetBranch]);

  async function installGitHubApp() {
    const slug = import.meta.env.VITE_GITHUB_APP_SLUG;
    if (!slug) { setError("Set VITE_GITHUB_APP_SLUG in client/.env to enable GitHub App installation."); return; }
    setError("");
    try {
      const { state } = await createGitHubInstallState();
      window.location.assign(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new?state=${encodeURIComponent(state)}`);
    } catch (installError) {
      setError(installError.message || "Unable to start GitHub App installation.");
    }
  }

  async function openSubmission(submissionId) {
    if (expandedId === submissionId) { setExpandedId(""); return; }
    setExpandedId(submissionId);
    setValidation(null);
    setReviews([]);
    setDiff(null);
    setDiffSubmissionId("");
    setDiffError("");
    setError("");
    try {
      const [validationData, reviewData] = await Promise.all([
        getSubmissionValidation(submissionId),
        getSubmissionReviews(submissionId),
      ]);
      setValidation(validationData);
      setReviews(reviewData.reviews || []);
      setComment((current) => ({ ...current, reviewId: reviewData.reviews?.at(-1)?.id || "" }));
    } catch (loadError) {
      setError(loadError.message || "Unable to load submission details.");
    }
  }

  async function loadDiff(submissionId) {
    setDiffLoading(true);
    setDiffError("");
    try {
      setDiff(await getSubmissionDiff(submissionId));
      setDiffSubmissionId(submissionId);
    } catch (loadError) {
      setDiffError(loadError.message || "Unable to load the code diff.");
    } finally {
      setDiffLoading(false);
    }
  }

  async function create(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const submission = await createSubmission(form);
      setNotice("Submission created. Run validation to start the governance checks.");
      setForm((current) => ({ ...current, title: "", description: "", baseCommitSha: "", headCommitSha: "" }));
      await loadData();
      setExpandedId(submission.id);
      setValidation(null);
    } catch (saveError) {
      setError(saveError.message || "Unable to create submission.");
    } finally {
      setSaving(false);
    }
  }

  async function runValidation(submissionId) {
    setError("");
    setNotice("");
    try {
      await validateSubmission(submissionId);
      setNotice("Validation queued. Refresh the result panel in a moment to see findings.");
      setExpandedId(submissionId);
    } catch (actionError) {
      setError(actionError.message || "Unable to start validation.");
    }
  }

  async function refreshDetails(submissionId) {
    setError("");
    try {
      const [validationData, reviewData] = await Promise.all([getSubmissionValidation(submissionId), getSubmissionReviews(submissionId)]);
      setValidation(validationData);
      setReviews(reviewData.reviews || []);
    } catch (loadError) {
      setError(loadError.message || "Unable to refresh submission details.");
    }
  }

  async function requestReview(submissionId) {
    setError("");
    try {
      await requestSubmissionReview(submissionId);
      setNotice("Review requested.");
      await loadData();
    } catch (actionError) {
      setError(actionError.message || "Unable to request review.");
    }
  }

  async function review(submissionId, decision) {
    const body = window.prompt("Add an optional review note:") || "";
    setError("");
    try {
      await submitSubmissionReview(submissionId, { decision, body });
      setNotice("Review submitted.");
      await refreshDetails(submissionId);
      await loadData();
    } catch (actionError) {
      setError(actionError.message || "Unable to submit review.");
    }
  }

  async function addComment(submissionId) {
    if (!comment.reviewId || !comment.filePath.trim() || !comment.body.trim()) return;
    setError("");
    try {
      await addSubmissionReviewComment(submissionId, comment.reviewId, { filePath: comment.filePath.trim(), line: Number(comment.line), body: comment.body.trim() });
      setComment((current) => ({ ...current, body: "" }));
      await refreshDetails(submissionId);
    } catch (actionError) {
      setError(actionError.message || "Unable to add review comment.");
    }
  }

  return <main className="min-h-[calc(100vh-64px)] bg-[#FFF8F1] px-5 py-8 text-[#302D3B] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Code Governance</h1>
      <p className="mt-1 text-sm text-[#827C89]">Submit a connected GitHub repository change for automated validation and review.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-[#E5BEBB] bg-[#FBE3DF] px-4 py-3 text-sm text-[#9B5555]">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl border border-[#D8E4DC] bg-[#EEF5EF] px-4 py-3 text-sm text-[#526E5C]">{notice}</p>}

      <section className="mt-7 rounded-2xl border border-[#E8D9DE] bg-white p-5 sm:p-7">
        <h2 className="text-lg font-semibold">New submission</h2>
        {!canWrite && <p className="mt-4 rounded-xl bg-[#FFF8F1] p-4 text-sm text-[#827C89]">Reviewer access is read-only. You can view repository files and submission details.</p>}
        {canWrite && <>
        {repositories.length === 0 && <div className="mt-4 rounded-xl bg-[#FFF8F1] p-4"><p className="text-sm text-[#827C89]">Connect the HAKI GitHub App to make repositories available for submissions and automated validation.</p><button type="button" onClick={installGitHubApp} className="mt-3 rounded-xl bg-[#B9BFDD] px-4 py-2.5 text-sm font-semibold">Connect GitHub App</button></div>}
        {repositories.length > 0 && <div className="mb-5 flex justify-end"><button type="button" onClick={installGitHubApp} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm">Add GitHub installation</button></div>}
        {repositories.length > 0 && <form onSubmit={create} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">Repository<select required value={form.repositoryId} onChange={(event) => setForm({ ...form, repositoryId: event.target.value, sourceBranch: "", targetBranch: "", headCommitSha: "", baseCommitSha: "" })} className={`${fieldClass} mt-2`}>{repositories.map((repo) => <option key={repo.id} value={repo.id}>{repo.fullName}</option>)}</select></label>
          <label className="text-sm font-medium md:col-span-2">Submission title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className={`${fieldClass} mt-2`} placeholder="What changed?" /></label>
          <label className="text-sm font-medium">Source branch<select required value={form.sourceBranch} onChange={(event) => setForm({ ...form, sourceBranch: event.target.value, headCommitSha: "" })} className={`${fieldClass} mt-2`}>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select></label>
          <label className="text-sm font-medium">Target branch<select required value={form.targetBranch} onChange={(event) => setForm({ ...form, targetBranch: event.target.value, baseCommitSha: "" })} className={`${fieldClass} mt-2`}>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select></label>
          <label className="text-sm font-medium">Base commit<select required value={form.baseCommitSha} onChange={(event) => setForm({ ...form, baseCommitSha: event.target.value })} className={`${fieldClass} mt-2 font-mono`}>{targetCommits.map((commit) => <option key={commit.sha} value={commit.sha}>{commit.sha.slice(0, 10)} ? {commit.message}</option>)}</select></label>
          <label className="text-sm font-medium">Head commit<select required value={form.headCommitSha} onChange={(event) => setForm({ ...form, headCommitSha: event.target.value })} className={`${fieldClass} mt-2 font-mono`}>{sourceCommits.map((commit) => <option key={commit.sha} value={commit.sha}>{commit.sha.slice(0, 10)} ? {commit.message}</option>)}</select></label>
          <label className="text-sm font-medium md:col-span-2">Description<textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={`${fieldClass} mt-2 resize-y`} /></label>
          <div className="md:col-span-2"><button disabled={saving} className="rounded-xl bg-[#B9BFDD] px-5 py-3 text-sm font-semibold disabled:opacity-50">{saving ? "Creating..." : "Create submission"}</button></div>
        </form>}
        </>}
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Submissions</h2><button onClick={loadData} className="rounded-lg border border-[#DCD2DC] bg-white px-3 py-2 text-sm">Refresh</button></div>
        {loading ? <p className="mt-4 text-sm text-[#827C89]">Loading submissions...</p> : submissions.length === 0 ? <p className="mt-4 rounded-xl border border-[#E8D9DE] bg-white p-6 text-sm text-[#827C89]">No submissions yet.</p> : <div className="mt-4 space-y-4">{submissions.map((submission) => <article key={submission.id} className="rounded-2xl border border-[#E8D9DE] bg-white p-5 sm:p-6">
          <button onClick={() => openSubmission(submission.id)} className="w-full text-left"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{submission.title}</h3><span className="rounded-full bg-[#E6EFFD] px-3 py-1 text-xs font-semibold">{submission.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-[#7187AC]">{submission.repository.fullName} · {submission.sourceBranch} → {submission.targetBranch}</p><p className="mt-2 line-clamp-2 text-sm text-[#827C89]">{submission.description || "No description provided."}</p></button>
          <div className="mt-4 flex flex-wrap gap-2">{submission.memberRole !== "REVIEWER" && <button onClick={() => runValidation(submission.id)} className="rounded-lg bg-[#E6EFFD] px-3 py-2 text-sm font-medium text-[#526B91]">Run validation</button>}<button onClick={() => refreshDetails(submission.id)} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm">Refresh results</button>{submission.memberRole !== "REVIEWER" && submission.status === "SUBMITTED" && expandedId === submission.id && validation?.status === "COMPLETED" && <button onClick={() => requestReview(submission.id)} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm">Request review</button>}{submission.memberRole !== "REVIEWER" && submission.status === "IN_REVIEW" && <><button onClick={() => review(submission.id, "APPROVED")} className="rounded-lg bg-[#EEF5EF] px-3 py-2 text-sm text-[#526E5C]">Approve</button><button onClick={() => review(submission.id, "CHANGES_REQUESTED")} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm">Request changes</button><button onClick={() => review(submission.id, "REJECTED")} className="rounded-lg bg-[#FBE3DF] px-3 py-2 text-sm text-[#9B5555]">Reject</button></>}</div>
          {expandedId === submission.id && <div className="mt-5 space-y-5 border-t border-[#E8D9DE] pt-5">
            <section className="rounded-xl border border-[#E8D9DE] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h4 className="text-sm font-semibold">Code diff</h4><p className="mt-1 text-xs text-[#827C89]">{submission.baseCommitSha.slice(0, 10)} → {submission.headCommitSha.slice(0, 10)}</p></div>
                <button type="button" onClick={() => loadDiff(submission.id)} disabled={diffLoading} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm disabled:opacity-50">{diffLoading ? "Loading diff..." : diffSubmissionId === submission.id ? "Reload diff" : "View code diff"}</button>
              </div>
              {diffError && <p role="alert" className="mt-3 text-sm text-[#9B5555]">{diffError}</p>}
              {diffSubmissionId === submission.id && diff && <>
                <p className="mt-3 text-xs text-[#706B79]">{diff.filesChanged} file(s) changed · +{diff.additions} −{diff.deletions} lines · {diff.aheadBy} commit(s) ahead</p>
                {diff.omittedFiles > 0 && <p className="mt-2 text-xs text-[#9B5555]">Showing the first {diff.files.length} files. {diff.omittedFiles} more files were omitted from this view.</p>}
                {diff.files.length > 0 && <input value={fileFilter} onChange={(event) => setFileFilter(event.target.value)} placeholder="Filter changed files..." aria-label="Filter changed files" className={`${fieldClass} mt-3`} />}
                {diff.files.length === 0 ? <p className="mt-3 rounded-lg bg-[#FFF8F1] p-3 text-sm text-[#827C89]">No file changes between these commits.</p> : <div className="mt-3 space-y-2">{diff.files.filter((file) => file.filename.toLowerCase().includes(fileFilter.toLowerCase())).map((file) => <details key={`${file.filename}-${file.status}`} className="overflow-hidden rounded-lg border border-[#E8D9DE]">
                  <summary className="cursor-pointer bg-[#FFF8F1] px-3 py-2 text-sm"><span className="font-mono">{file.filename}</span><span className="ml-2 text-xs text-[#827C89]">{file.status}{file.previousFilename ? ` from ${file.previousFilename}` : ""} · +{file.additions} −{file.deletions}</span></summary>
                  {file.patch ? <div className="max-h-[32rem] overflow-auto bg-[#FAFAFC] p-2"><div className="grid grid-cols-2 gap-px overflow-hidden rounded bg-[#E8D9DE] text-xs font-mono"><div className="bg-[#FFF8F1] px-2 py-1 font-sans font-semibold">Old</div><div className="bg-[#FFF8F1] px-2 py-1 font-sans font-semibold">New</div>{sideBySideRows(file.patch).map((row) => <Fragment key={row.key}><div className={`flex min-w-0 ${row.kind === "remove" ? "bg-[#FBEAEA] text-[#A33A3A]" : "bg-white text-[#514D5A]"}`}><span className="w-10 shrink-0 border-r border-[#EEE8EC] px-2 py-1 text-[#827C89]">{row.oldLine ?? ""}</span><span className="min-w-0 whitespace-pre px-2 py-1">{row.oldText || " "}</span></div><div className={`flex min-w-0 ${row.kind === "add" ? "bg-[#EAF6ED] text-[#26723C]" : "bg-white text-[#514D5A]"}`}><span className="w-10 shrink-0 border-r border-[#EEE8EC] px-2 py-1 text-[#827C89]">{row.newLine ?? ""}</span><span className="min-w-0 whitespace-pre px-2 py-1">{row.newText || " "}</span></div></Fragment>)}</div></div> : <p className="p-3 text-xs text-[#827C89]">GitHub did not provide a text patch for this file (it may be binary or too large).</p>}
                  {file.patchTruncated && <p className="border-t border-[#E8D9DE] px-3 py-2 text-xs text-[#827C89]">This file's patch was shortened to keep the response size manageable.</p>}
                </details>)}</div>}
              </>}
            </section>
            <div><h4 className="text-sm font-semibold">Validation</h4>{validation ? <><p className="mt-1 text-sm text-[#706B79]">{validation.status} · {validation.findings?.length || 0} findings</p>{validation.findings?.map((finding) => <p key={finding.id} className="mt-2 rounded-lg bg-[#FFF8F1] px-3 py-2 text-sm"><span className="font-semibold">{finding.severity}</span> · {finding.title}{finding.filePath && <span className="text-[#827C89]"> — {finding.filePath}{finding.line ? `:${finding.line}` : ""}</span>}</p>)}</> : <p className="mt-1 text-sm text-[#827C89]">No validation run yet.</p>}</div>
            <div><h4 className="text-sm font-semibold">Review history</h4>{reviews.length ? reviews.map((item) => <div key={item.id} className="mt-2 rounded-xl bg-[#FFF8F1] p-3"><p className="text-sm font-semibold">{item.decision.replaceAll("_", " ")} · {item.reviewer.name || "Reviewer"}</p>{item.body && <p className="mt-1 text-sm text-[#706B79]">{item.body}</p>}{item.comments?.map((entry) => <p key={entry.id} className="mt-2 border-l-2 border-[#B9BFDD] pl-3 text-xs text-[#706B79]">{entry.filePath}:{entry.line} — {entry.body}</p>)}</div>) : <p className="mt-1 text-sm text-[#827C89]">No reviews yet.</p>}</div>
            {submission.memberRole !== "REVIEWER" && reviews.length > 0 && <form onSubmit={(event) => { event.preventDefault(); addComment(submission.id); }} className="grid gap-3 rounded-xl bg-[#F7F5FA] p-3 sm:grid-cols-[1fr_100px_2fr_auto]"><select required value={comment.reviewId} onChange={(event) => setComment({ ...comment, reviewId: event.target.value })} className={fieldClass} aria-label="Review thread">{reviews.map((item) => <option key={item.id} value={item.id}>{item.decision.replaceAll("_", " ")}</option>)}</select><input required type="number" min="1" value={comment.line} onChange={(event) => setComment({ ...comment, line: event.target.value })} className={fieldClass} aria-label="Line number" /><input required value={comment.filePath} onChange={(event) => setComment({ ...comment, filePath: event.target.value })} className={fieldClass} placeholder="Select a line above or enter a file path" /><div className="flex gap-2"><input required value={comment.body} onChange={(event) => setComment({ ...comment, body: event.target.value })} className={fieldClass} placeholder="Write a review comment" /><button className="rounded-lg bg-[#B9BFDD] px-3 text-sm font-semibold">Add comment</button></div></form>}
          </div>}
        </article>)}</div>}
      </section>
    </div>
  </main>;
}
