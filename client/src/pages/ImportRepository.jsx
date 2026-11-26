import { useState } from "react";
import { ArrowLeft, ExternalLink, Github, LoaderCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { getGitHubInstallUrl } from "../services/api";

export default function ImportRepository() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    setBusy(true); setError("");
    try {
      const response = await getGitHubInstallUrl();
      setUrl(response.data.url);
      window.location.assign(response.data.url);
    } catch (err) { setError(err.message || "Could not start GitHub App setup."); setBusy(false); }
  }
  return <main className="mx-auto min-h-[calc(100vh-80px)] max-w-3xl px-5 py-12 sm:px-8">
    <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft size={16}/>Back to workspace</Link>
    <section className="rounded-3xl border border-[#E8D9DE] bg-white p-7 shadow-sm sm:p-10"><span className="inline-flex rounded-2xl bg-slate-900 p-3 text-white"><Github size={24}/></span><h1 className="mt-5 text-3xl font-black">Connect GitHub</h1><p className="mt-3 leading-7 text-slate-600">Install the HAKI GitHub App on a personal account or organization and choose which repositories it can access. HAKI will sync the selected repositories and use the app installation to read branch contents for governance scans.</p>
      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      <button disabled={busy} onClick={connect} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle size={18} className="animate-spin"/> : <ExternalLink size={18}/>}Continue to GitHub</button>
      {url && <p className="mt-3 break-all text-xs text-slate-500">If redirect did not open, continue here: <a className="text-blue-700 underline" href={url}>GitHub App setup</a></p>}
      <p className="mt-8 border-t pt-5 text-sm text-slate-500">After installation, GitHub returns you here and the repositories appear in your workspace.</p>
    </section>
  </main>;
}
