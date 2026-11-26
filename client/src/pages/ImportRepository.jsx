import { useRef, useState } from "react";
import { CheckCircle2, FileArchive, FolderGit2, UploadCloud, X } from "lucide-react";

export default function ImportRepository() {
  const picker = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  function selectFile(candidate) {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".zip")) { setError("Choose a ZIP file to continue."); return; }
    setError(""); setFile(candidate); setSubmitted(false);
  }
  const size = file ? (file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(2)} MB`) : "";
  return <main className="min-h-[calc(100vh-64px)] bg-[#FFF8F1] px-5 py-8 text-[#302D3B] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <div className="mb-7 flex items-center gap-3"><span className="rounded-xl bg-[#E6EFFD] p-3 text-[#7187AC]"><FolderGit2 size={25} /></span><div><h1 className="text-2xl font-bold">Import Repository</h1><p className="mt-1 text-sm text-[#827C89]">Select an existing ZIP to preview the import flow.</p></div></div>
      {submitted ? <section className="rounded-3xl border border-[#E8D9DE] bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto mb-4 text-[#64816D]" size={48} /><h2 className="text-xl font-semibold">ZIP selected</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#827C89]">The frontend preview confirms your selection, but it does not unpack the archive or save its files. ZIP processing needs a backend service.</p><button onClick={() => { setSubmitted(false); setFile(null); }} className="mt-6 rounded-xl bg-[#B9BFDD] px-5 py-3 text-sm font-semibold hover:bg-[#AEB6D8]">Choose another ZIP</button></section> : <section className="rounded-3xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-8">
        <h2 className="text-lg font-semibold">Upload your repository</h2><p className="mt-1 text-sm text-[#827C89]">Drop a ZIP file here or browse your computer.</p>
        <div role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") picker.current?.click(); }} onClick={() => picker.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }} className={`mt-6 cursor-pointer rounded-2xl border-2 border-dashed px-5 py-14 text-center transition sm:py-20 ${dragging ? "border-[#7187AC] bg-[#E6EFFD]" : "border-[#DCD2DC] bg-[#FFFCFA] hover:border-[#A9B9D3] hover:bg-[#FFF8F1]"}`}>
          <input ref={picker} type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => { selectFile(event.target.files?.[0]); event.target.value = ""; }} />
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#E6EFFD] text-[#7187AC]"><UploadCloud size={32} /></span><h3 className="font-semibold">Drag and drop your ZIP file here</h3><p className="mt-1 text-sm text-[#827C89]">or browse files on your computer</p><span className="mt-5 inline-flex rounded-xl bg-[#B9BFDD] px-5 py-2.5 text-sm font-semibold">Browse files</span><p className="mt-4 text-xs text-[#958F9B]">Supported format: ZIP</p>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-[#A96060]">{error}</p>}
        {file && <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#E8D9DE] bg-[#FFF8F1] p-4"><FileArchive className="text-[#7187AC]" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{file.name}</p><p className="text-xs text-[#827C89]">{size}</p></div><button aria-label="Remove file" onClick={() => setFile(null)} className="rounded-lg p-2 text-[#827C89] hover:bg-white"><X size={18} /></button></div>}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[#E8D9DE] pt-5 sm:flex-row"><p className="text-xs text-[#827C89]">Preview only: ZIP processing needs a backend.</p><button disabled={!file} onClick={() => setSubmitted(true)} className="w-full rounded-xl bg-[#B9BFDD] px-6 py-3 text-sm font-semibold text-[#302D3B] hover:bg-[#AEB6D8] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">Import Repository</button></div>
      </section>}
    </div>
  </main>;
}
