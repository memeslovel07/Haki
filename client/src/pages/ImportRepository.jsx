import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, FileArchive, FolderGit2, Loader2, UploadCloud, X } from "lucide-react";
import { createFile, createRepository, deleteRepository, requestHakiBackend } from "../services/api";

export default function ImportRepository() {
  const picker = useRef(null);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function selectFile(candidate) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".zip")) { setError("Choose a ZIP file to continue."); return; }
    setError(""); setFile(candidate);
  }

  async function importRepository() {
    if (!file) return;
    let createdId;
    setLoading(true); setError("");
    try {
      const result = await requestHakiBackend("import/zip", { method: "POST", headers: { "Content-Type": "application/zip" }, body: file });
      if (!result.files?.length) throw new Error("No supported text or code files were found in this ZIP.");
      const imported = await createRepository({ name: file.name.replace(/\.zip$/i, "").slice(0, 100), description: "Imported from " + file.name, visibility: "private" });
      createdId = imported.data.id;
      for (const entry of result.files) await createFile(createdId, { name: entry.name, path: entry.path, content: entry.content, size: entry.size, mimeType: "text/plain" });
      navigate("/repositories/" + createdId);
    } catch (problem) {
      if (createdId) { try { await deleteRepository(createdId); } catch { /* retain the import error */ } }
      setError(problem.message || "Repository import failed.");
    } finally { setLoading(false); }
  }

  const size = file ? (file.size < 1024 * 1024 ? (file.size / 1024).toFixed(1) + " KB" : (file.size / 1024 / 1024).toFixed(2) + " MB") : "";
  return <main className="min-h-[calc(100vh-64px)] bg-[#FFF8F1] px-5 py-8 text-[#302D3B] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center gap-3"><span className="rounded-xl bg-[#E6EFFD] p-3 text-[#7187AC]"><FolderGit2 size={25}/></span><div><h1 className="text-2xl font-bold">Import Repository</h1><p className="mt-1 text-sm text-[#827C89]">Import a ZIP to your private workspace and automatically scan it.</p></div></div>
      <section className="rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Upload your repository</h2><p className="mt-1 text-sm text-[#827C89]">ZIP archives up to 10 MB; supported text files up to 1.5 MB total.</p>
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") picker.current?.click(); }} onClick={() => picker.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }} className={`mt-6 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-14 text-center transition sm:py-20 ${dragging ? "border-[#7187AC] bg-[#E6EFFD]" : "border-[#DCD2DC] bg-[#FFFCFA] hover:border-[#A9B9D3] hover:bg-[#FFF8F1]"}`}>
          <input ref={picker} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }}/><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6EFFD] text-[#7187AC]"><UploadCloud size={32}/></span><h3 className="font-semibold">Drag and drop your ZIP file here</h3><p className="mt-1 text-sm text-[#827C89]">or browse files on your computer</p><span className="mt-5 inline-flex rounded-xl bg-[#B9BFDD] px-5 py-2.5 text-sm font-semibold">Browse files</span>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[#A96060]">{error}</p>}
        {file && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E8D9DE] bg-[#FFF8F1] p-4"><FileArchive className="text-[#7187AC]"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-[#827C89]">{size}</p></div><button aria-label="Remove file" onClick={() => setFile(null)} className="rounded-lg p-2 text-[#827C89] hover:bg-white"><X size={18}/></button></div>}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#E8D9DE] pt-5 sm:flex-row"><p className="text-xs text-[#827C89]">.git, node_modules, build output and binaries are skipped.</p><button disabled={!file || loading} onClick={importRepository} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#B9BFDD] px-6 py-3 text-sm font-semibold text-[#302D3B] hover:bg-[#AEB6D8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{loading && <Loader2 size={16} className="animate-spin"/>}{loading ? "Importing and scanning…" : "Import Repository"}</button></div>
      </section>
    </div>
  </main>;
}
