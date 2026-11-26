import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, FolderGit2, GitPullRequest, LoaderCircle, RefreshCw } from "lucide-react";
import { getRepositories, getSubmissions } from "../services/api";

function Dashboard({ user, onUserUpdate, onSignOut }) {
  const navigate = useNavigate();
  const [repositories, setRepositories] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [repoResponse, submissionResponse] = await Promise.all([getRepositories(), getSubmissions()]);
      setRepositories(repoResponse.data);
      setSubmissions(submissionResponse.data);
    } catch (err) {
      setError(err.message || "Could not load your HAKI workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") setNotice(`GitHub connected${params.get("account") ? `: ${params.get("account")}` : ""}. ${params.get("repositories") || 0} repositories synchronized.`);
    if (params.has("github_error")) setError("GitHub App setup did not complete. Try connecting again.");
    if (params.has("github") || params.has("github_error")) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  return <div className="min-h-screen bg-[#FFF8F1] text-[#302D3B]">
    <header className="border-b border-[#E8D9DE] bg-white/90"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <Link to="/" className="text-2xl font-black">haki<span className="text-blue-500">.</span></Link>
      <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-600 sm:inline">{user?.fullName || user?.email}</span><button onClick={onSignOut} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></div>
    </div></header>
    <main className="mx-auto max-w-7xl px-5 py-9 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#7187AC]">Version control and code governance</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Your HAKI workspace</h1><p className="mt-2 text-slate-600">Connect GitHub repositories, submit changes, run checks, and review results.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-semibold"><RefreshCw size={16} className={loading ? "animate-spin" : ""}/>Refresh</button></div>
      {error && <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {notice && <div role="status" className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900">{notice}<button onClick={() => setNotice("")} className="ml-4 font-bold">Dismiss</button></div>}
      {loading ? <div className="flex items-center gap-3 rounded-2xl border bg-white p-10 text-slate-500"><LoaderCircle className="animate-spin"/>Loading workspace…</div> : <>
        <section className="mb-10"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">GitHub repositories <span className="ml-2 text-sm font-normal text-slate-500">{repositories.length}</span></h2><Link to="/import" className="text-sm font-semibold text-blue-700">Connect GitHub</Link></div>
          {repositories.length ? <div className="grid gap-4 md:grid-cols-2">{repositories.map((repo) => <article key={repo.id} className="rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><FolderGit2 size={20}/></span><div><h3 className="font-bold">{repo.fullName}</h3><p className="mt-1 text-xs text-slate-500">Default branch: {repo.defaultBranch} · {repo.isPrivate ? "Private" : "Public"}</p></div></div><a href={repo.htmlUrl} target="_blank" rel="noreferrer" aria-label={`Open ${repo.fullName} on GitHub`} className="text-slate-500 hover:text-blue-700"><ExternalLink size={17}/></a></div><button onClick={() => navigate(`/repositories/${repo.id}`)} className="mt-5 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white">Open governance workspace</button></article>)}</div> : <div className="rounded-2xl border border-dashed bg-white p-8 text-center"><FolderGit2 className="mx-auto text-slate-400"/><h3 className="mt-3 font-bold">No GitHub repositories connected</h3><p className="mt-1 text-sm text-slate-600">Install the HAKI GitHub App to bring repositories into this workspace.</p><Link to="/import" className="mt-4 inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Connect GitHub</Link></div>}
        </section>
        <section><div className="mb-4 flex items-center gap-2"><GitPullRequest size={20}/><h2 className="text-xl font-bold">Recent submissions</h2></div>{submissions.length ? <div className="overflow-hidden rounded-2xl border bg-white">{submissions.map((submission) => <button key={submission.id} onClick={() => navigate(`/submissions/${submission.id}`)} className="flex w-full flex-wrap items-center justify-between gap-3 border-b px-5 py-4 text-left last:border-0 hover:bg-slate-50"><span><span className="block font-semibold">{submission.title}</span><span className="mt-1 block text-xs text-slate-500">{submission.repository.fullName} · {submission.sourceBranch} → {submission.targetBranch}</span></span><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800">{submission.status.replaceAll("_", " ")}</span></button>)}</div> : <p className="rounded-2xl border bg-white p-6 text-sm text-slate-600">No code submissions yet. Open a repository workspace to submit a branch for governance checks.</p>}</section>
      </>}
      <footer className="mt-12 border-t pt-5 text-xs text-slate-500">HAKI workspace · Connected to the HAKI API</footer>
    </main>
  </div>;
}

export default Dashboard;
