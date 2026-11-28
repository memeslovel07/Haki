import { useRef, useState } from "react";
import { FileArchive, FolderGit2, UploadCloud, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { importZipRepository } from "../services/api";

export default function ImportRepository() {
  const picker = useRef(null);
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  function selectFile(candidate) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".zip")) { setError("Choose a ZIP file to continue."); return; }
    if (candidate.size > 20 * 1024 * 1024) { setError("ZIP files must be smaller than 20 MB."); return; }
    setError("");
    setFile(candidate);
    setName(candidate.name.replace(/\.zip$/i, "").slice(0, 100));
  }

  async function importRepository() {
    if (!file || !name.trim()) return;
    setError("");
    setImporting(true);
    try {
      const repository = await importZipRepository(file, name.trim());
      navigate(`/repositories/${repository.id}`, { replace: true });
    } catch (importError) {
      setError(importError.message || "Unable to import repository.");
    } finally {
      setImporting(false);
    }
  }

  const size = file ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`) : "";
  return <main className="min-h-[calc(100vh-64px)] bg-[#FFF8F1] px-5 py-8 text-[#302D3B]">
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center gap-3"><span className="rounded-xl bg-[#E6EFFD] p-3 text-[#7187AC]"><FolderGit2 size={25} /></span><div><h1 className="text-2xl font-bold">Import Repository</h1><p className="mt-1 text-sm text-[#827C89]">Upload a ZIP with or without a top-level folder. Its files and initial snapshot will be saved in HAKI.</p></div></div>
      <section className="rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Upload your repository</h2><p className="mt-1 text-sm text-[#827C89]">ZIP files up to 20 MB are supported.</p>
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") picker.current?.click(); }} onClick={() => picker.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }} className={`mt-6 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-14 text-center transition sm:py-20 ${dragging ? "border-[#7187AC] bg-[#E6EFFD]" : "border-[#DCD2DC] bg-[#FFFCFA] hover:border-[#A9B9D3] hover:bg-[#FFF8F1]"}`}>
          <input ref={picker} type="file" accept=".zip,application/zip" className="hidden" onClick={(event) => event.stopPropagation()} onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6EFFD] text-[#7187AC]"><UploadCloud size={32} /></span><h3 className="font-semibold">Drag and drop your ZIP file here</h3><p className="mt-1 text-sm text-[#827C89]">or browse files on your computer</p><span className="mt-5 inline-flex rounded-xl bg-[#B9BFDD] px-5 py-2.5 text-sm font-semibold">Browse files</span>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[#A96060]">{error}</p>}
        {file && <>
          <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E8D9DE] bg-[#FFF8F1] p-4"><FileArchive className="text-[#7187AC]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-[#827C89]">{size}</p></div><button aria-label="Remove file" onClick={() => { setFile(null); setName(""); }} className="rounded-lg p-2 text-[#827C89] hover:bg-white"><X size={18} /></button></div>
          <label className="mt-5 block text-sm font-medium">Repository name<input value={name} maxLength={100} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 outline-none focus:border-[#A9B9D3]" /></label>
        </>}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#E8D9DE] pt-5 sm:flex-row"><p className="text-xs text-[#827C89]">Files are validated and saved to your HAKI account.</p><button disabled={!file || !name.trim() || importing} onClick={importRepository} className="w-full rounded-xl bg-[#B9BFDD] px-6 py-3 text-sm font-semibold text-[#302D3B] hover:bg-[#AEB6D8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{importing ? "Importing..." : "Import Repository"}</button></div>
      </section>
    </div>
  </main>;
}
