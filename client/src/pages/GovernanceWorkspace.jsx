import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, GitBranch, GitPullRequest, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createSubmission, getRepository, getRepositoryBranches, getSubmissions } from "../services/api";

export default function GovernanceWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [repo, setRepo] = useState(null);
  const [branches, setBranches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", sourceBranch: "", targetBranch: "", });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [repoResult, branchResult, submissionResult] = await Promise.all([getRepository(id), getRepositoryBranches(id), getSubmissions(id)]);
      setRepo(repoResult.data); setBranches(branchResult.data); setSubmissions(submissionResult.data);
      setForm((current) => ({ ...current, targetBranch: current.targetBranch || repoResult.data.defaultBranch, sourceBranch: current.sourceBranch || branchResult.data.find((branch) => branch.name !== repoResult.data.defaultBranch)?.name || "" }));
    } catch (err) { setError(err.message || "Could not load repository governance data."); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const source = useMemo(() => branches.find((branch) => branch.name === form.sourceBranch), [branches, form.sourceBranch]);
  const target = useMemo(() => branches.find((branch) => branch.name === form.targetBranch), [branches, form.targetBranch]);

  async function submit(event) {
    event.preventDefault();
    if (!source || !target || source.name === target.name) { setError("Choose different source and target branches."); return; }
    setSaving(true); setError("");
    try {
      const result = await createSubmission({ repositoryId: id, title: form.title, description: form.description, sourceBranch: source.name, targetBranch: target.name, headCommitSha: source.commit.sha, baseCommitSha: target.commit.sha });
      navigate(`/submissions/${result.data.id}`);
    } catch (err) { setError(err.message || "Could not create submission."); }
    finally { setSaving(false); }
  }

  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-9 sm:px-8">
    <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Workspace</Link>
    {loading ? <div className="mt-8 flex items-center gap-3 rounded-2xl border bg-white p-8 text-slate-600"><LoaderCircle className="animate-spin"/>Loading repository…</div> : <>
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      <section className="mt-6 rounded-3xl border bg-white p-6 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-blue-700">GitHub repository</p><h1 className="mt-2 text-3xl font-black">{repo?.fullName}</h1><a href={repo?.htmlUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-blue-700 underline">Open on GitHub</a></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><RefreshCw size={15}/>Refresh</button></div></section>
      <section className="mt-8"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Code submissions</h2><p className="mt-1 text-sm text-slate-500">Each submission records branch heads, governance checks, and review decisions.</p></div><button onClick={() => { setError(""); setOpen((value) => !value); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"><Plus size={17}/>New submission</button></div>
        {open && <form onSubmit={submit} className="mb-5 grid gap-4 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="sm:col-span-2 text-sm font-semibold">Title<input required maxLength={200} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Describe the change" className="mt-1 w-full rounded-lg border px-3 py-2.5 font-normal"/></label><label className="sm:col-span-2 text-sm font-semibold">Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} placeholder="Optional context for reviewers" className="mt-1 w-full rounded-lg border px-3 py-2.5 font-normal"/></label><label className="text-sm font-semibold">Source branch<select required value={form.sourceBranch} onChange={(event) => setForm({ ...form, sourceBranch: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 font-normal"><option value="">Choose a branch</option>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select></label><label className="text-sm font-semibold">Target branch<select required value={form.targetBranch} onChange={(event) => setForm({ ...form, targetBranch: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5 font-normal"><option value="">Choose a branch</option>{branches.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}</select></label><div className="flex items-center gap-2 text-xs text-slate-500 sm:col-span-2"><GitBranch size={15}/>{source ? `Head ${source.commit.sha.slice(0, 12)}` : "Select a source branch"}{target ? ` · Base ${target.commit.sha.slice(0, 12)}` : " · Select a target branch"}</div><div className="flex justify-end gap-2 sm:col-span-2"><button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-4 py-2.5 text-sm">Cancel</button><button disabled={saving || !branches.length} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Submitting…" : "Create submission"}</button></div></form>}
        {!submissions.length ? <div className="rounded-2xl border border-dashed bg-white p-10 text-center"><GitPullRequest className="mx-auto text-slate-400"/><p className="mt-3 font-semibold">No submissions yet</p><p className="mt-1 text-sm text-slate-500">Submit a branch to run HAKI code governance checks.</p></div> : <div className="overflow-hidden rounded-2xl border bg-white">{submissions.map((submission) => <button key={submission.id} onClick={() => navigate(`/submissions/${submission.id}`)} className="flex w-full flex-wrap items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-slate-50"><span><span className="block font-semibold">{submission.title}</span><span className="mt-1 block text-xs text-slate-500">{submission.sourceBranch} → {submission.targetBranch} · {submission.headCommitSha.slice(0, 12)}</span></span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{submission.status.replaceAll("_", " ")}</span></button>)}</div>}
      </section>
    </>}
  </main>;
}
