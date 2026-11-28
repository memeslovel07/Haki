import { useCallback, useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Moon, Sun } from "lucide-react";

import {
  getRepository,
  getFiles,
  createFile,
  updateFile,
  deleteFile,
  getCommits,
  createCommit,
} from "../services/api";

import DirectoryTree from "../components/DirectoryTree";
import UserAvatar from "../components/UserAvatar";

function RepositoryWorkspace({ user, onUserUpdate, onSignOut, theme, onThemeToggle }) {
  const { id, fileId } = useParams();
  const navigate = useNavigate();

  const [repository, setRepository] = useState(null);
  const canManageRepository = user?.role === "admin" || repository?.ownerId === user?.id;
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const readmeFile = files.find((file) => /(^|\/)readme(?:\.[^/]*)?$/i.test(file.path || file.name || ""));
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [newFile, setNewFile] = useState({
    name: "",
    path: "",
    content: "",
  });

  const [commits, setCommits] = useState([]);
  const [showAllCommits, setShowAllCommits] = useState(false);

  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);

  function openFile(file) {
    setSelectedFile(file);
    setEditedContent(file.content || "");
    navigate(`/repositories/${id}/${encodeURIComponent(file.id)}`);
  }

  function closeFile() {
    setSelectedFile(null);
    navigate(`/repositories/${id}`);
  }

  function openCreateFileModal() {
    setError("");

    setNewFile({
      name: "",
      path: "",
      content: "",
    });

    setCreateModalOpen(true);
  }

  async function handleCreateFile(event) {
    event.preventDefault();

    try {
      setError("");

      if (!newFile.name.trim()) {
        setError("File name is required.");
        return;
      }

      if (!newFile.path.trim()) {
        setError("File path is required.");
        return;
      }

      const response = await createFile(id, {
        name: newFile.name.trim(),
        path: newFile.path.trim(),
        content: newFile.content,
      });

      const createdFile = response.data;

      setFiles((currentFiles) => [
        ...currentFiles,
        createdFile,
      ]);

      setSelectedFile(createdFile);
      setEditedContent(createdFile.content || "");

      setNewFile({
        name: "",
        path: "",
        content: "",
      });

      setCreateModalOpen(false);
    } catch (error) {
      console.error("Failed to create file:", error);
      setError(error.message || "Failed to create file.");
    }
  }

  async function handleUploadFile(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (selectedFiles.length === 0) return;

    try {
      setUploading(true);
      setError("");

      const uploadedFiles = [];

      for (const file of selectedFiles) {
        if (file.size > 1_400_000) {
          throw new Error(`“${file.name}” is too large. Choose a file smaller than 1.4 MB.`);
        }

        let content;
        try {
          const buffer = await file.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          let binary = "";
          const chunkSize = 8192;
          for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
          }
          content = btoa(binary);
        } catch {
          content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = () => reject(new Error(`HAKI could not read “${file.name}”. Re-select it, or copy it to Downloads/Desktop and try again.`));
            reader.readAsDataURL(file);
          });
        }

        const filePath = file.webkitRelativePath || file.name;

        const response = await createFile(id, {
          name: file.name,
          path: filePath,
          content,
          encoding: "base64",
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });

        uploadedFiles.push(response.data);
      }

      setFiles((currentFiles) => [
        ...currentFiles,
        ...uploadedFiles,
      ]);

      const lastUploadedFile =
        uploadedFiles[uploadedFiles.length - 1];

      setSelectedFile(lastUploadedFile);
      setEditedContent(lastUploadedFile.content || "");
    } catch (error) {
      console.error("Failed to upload files:", error);
      setError(error.message || "Failed to upload files.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleSaveFile() {
    if (!selectedFile) return;

    try {
      setSaving(true);
      setError("");

      const response = await updateFile(
        id,
        selectedFile.id,
        {
          content: editedContent,
        }
      );

      const updatedFile = response.data;

      setFiles((currentFiles) =>
        currentFiles.map((file) =>
          file.id === updatedFile.id
            ? updatedFile
            : file
        )
      );

      setSelectedFile(updatedFile);
    } catch (error) {
      console.error("Failed to save file:", error);
      setError(error.message || "Failed to save file.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteFile() {
    if (!selectedFile) return;

    const confirmed = window.confirm(
      `Delete file "${selectedFile.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteFile(id, selectedFile.id);

      const remainingFiles = files.filter(
        (file) => file.id !== selectedFile.id
      );

      setFiles(remainingFiles);

      if (remainingFiles.length > 0) {
        setSelectedFile(remainingFiles[0]);
        setEditedContent(remainingFiles[0].content || "");
      } else {
        setSelectedFile(null);
        setEditedContent("");
      }
    } catch (error) {
      console.error("Failed to delete file:", error);
      setError(error.message || "Failed to delete file.");
    }
  }

  async function handleCreateCommit(event) {
    event.preventDefault();

    if (!commitMessage.trim()) {
      setError("Commit message is required.");
      return;
    }

    try {
      setCommitting(true);
      setError("");

      const response = await createCommit(
        id,
        commitMessage.trim()
      );

      const newCommit = response.data;

      setCommits((currentCommits) => [
        newCommit,
        ...currentCommits,
      ]);

      setCommitMessage("");
      setCommitModalOpen(false);
    } catch (error) {
      console.error("Failed to create commit:", error);

      setError(
        error.message || "Failed to create commit."
      );
    } finally {
      setCommitting(false);
    }
  }

  const loadWorkspace = useCallback(async () => {
    try {
      const repositoryResponse = await getRepository(id);
      const filesResponse = await getFiles(id);
      const commitsResponse = await getCommits(id);

      setError("");
      setRepository(repositoryResponse.data);
      setFiles(filesResponse.data);
      setCommits(commitsResponse.data);

      const requestedFile = fileId
        ? filesResponse.data.find((file) => String(file.id) === fileId)
        : null;
      setSelectedFile(requestedFile || null);
      setEditedContent(requestedFile?.content || "");
    } catch (error) {
      console.error("Failed to load repository:", error);

      setError(
        error.message || "Failed to load repository."
      );
    } finally {
      setLoading(false);
    }
  }, [id, fileId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  if (loading) {
    return (
      <div className="repository-page page-enter min-h-screen bg-[#FAF8F1] text-[#4F574F]" data-theme={theme}>
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-[#777B72]">
            Loading repository...
          </p>
        </div>
      </div>
    );
  }

  if (error && !repository) {
    return (
      <div className="repository-page page-enter min-h-screen bg-[#FAF8F1] text-[#4F574F]" data-theme={theme}>
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-lg border border-[#E2D8C8] bg-[#F1E8DD] px-4 py-3 text-[#786F61]">
            {error}
          </div>

          <Link
            to="/"
            className="mt-6 inline-block text-sm text-[#7F8C77] hover:text-[#7F8C77]"
          >
            ← Back to repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="repository-page page-enter min-h-screen bg-[#FAF8F1] text-[#4F574F]" data-theme={theme}>

      <div className="border-b border-[#E5E7EC] bg-[#FAF8F1]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-sm text-[#777B72] transition hover:text-[#4F574F]"
              >
                Repositories
              </Link>

              <span className="text-[#92948A]">/</span>

              <h1 className="text-xl font-bold">
                {repository?.name}
              </h1>
              <span className="rounded-full border border-[#E1E3E8] bg-white px-2.5 py-1 text-xs font-semibold text-[#666B63]">
                {repository?.visibility === "public" ? "🌐 Public" : "🔒 Private"}
              </span>
            </div>

            <p className="mt-1 text-sm text-[#777B72]">
              {repository?.description || "No description"}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-9 w-9" />

            <span className="rounded-full bg-[#F0F1F4] px-4 py-2 text-sm text-[#5B6058]">
              main
            </span>

            <button type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="theme-toggle rounded-lg border border-[#E1E3E8] p-2 text-[#5B6058] hover:bg-[#F0F1F4]">{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button>

            <button onClick={onSignOut} title={`Signed in as ${user?.email || ""}`} className="rounded-lg border border-[#E1E3E8] px-3 py-2 text-sm text-[#5B6058] transition hover:bg-[#F0F1F4] hover:text-[#4F574F]">
              {user?.role === "admin" ? "Admin · Sign out" : "Sign out"}
            </button>

            {canManageRepository && <button
              onClick={openCreateFileModal}
              className="rounded-lg border border-[#E1E3E8] px-4 py-2 text-sm font-medium text-[#5B6058] transition hover:bg-[#F0F1F4] hover:text-[#4F574F]"
            >
              + New File
            </button>}

            {canManageRepository && <label className="cursor-pointer rounded-lg bg-[#E0E4EA] px-4 py-2 text-sm font-medium text-[#4F574F] transition hover:bg-[#B0BEAD]">
              {uploading ? "Uploading..." : "⬆ Upload File"}

              <input
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleUploadFile}
                disabled={uploading}
              />
            </label>}

            {canManageRepository && <label className="cursor-pointer rounded-lg border border-[#E1E3E8] px-4 py-2 text-sm font-medium text-[#5B6058] transition hover:bg-[#F0F1F4] hover:text-[#4F574F]">
              {uploading ? "Uploading..." : "📁 Upload Folder"}

              <input
                type="file"
                className="hidden"
                webkitdirectory="true"
                directory="true"
                multiple
                onChange={handleUploadFile}
                disabled={uploading}
              />
            </label>}

          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6">

        {error && (
          <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-[#E2D8C8] bg-[#F1E8DD] px-4 py-3 text-sm text-[#786F61]">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="text-lg hover:text-[#4F574F]"
            >
              ×
            </button>
          </div>
        )}

        {selectedFile ? (
          <section className="mb-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EC] px-4 py-5">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <button onClick={closeFile} className="shrink-0 font-medium text-[#438C89] hover:underline">{repository?.name}</button>
                <span className="text-[#92948A]">/</span>
                <span className="truncate font-semibold text-[#30332F]">{selectedFile.path || selectedFile.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[#E1E3E8] px-3 py-1.5 text-xs text-[#666B63]">Code</span>
                <button onClick={() => navigator.clipboard?.writeText(editedContent)} className="rounded-lg border border-[#E1E3E8] px-3.5 py-2 text-xs text-[#666B63] transition hover:bg-[#F0F1F4]">Copy file</button>
                {canManageRepository && <button onClick={handleDeleteFile} className="rounded-md border border-[#E2D8C8] px-3 py-1.5 text-xs text-[#786F61] hover:bg-[#F1E8DD]">Delete</button>}
                {canManageRepository && <button onClick={handleSaveFile} disabled={saving} className="rounded-md bg-[#438C89] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#367C79] disabled:opacity-50">{saving ? "Saving…" : "Save file"}</button>}
              </div>
            </div>
            {commits[0] && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EC] px-4 py-3 text-xs"><span className="font-medium text-[#5B6058]">{user?.fullName || user?.email} <span className="ml-2 font-normal text-[#777B72]">{commits[0].message}</span></span><span className="text-[#92948A]">{new Date(commits[0].createdAt).toLocaleString()}</span></div>}
            <div className={`overflow-auto py-5 font-mono text-sm leading-7 sm:py-7 ${theme === "dark" ? "text-[#E6EDF3]" : "text-[#30332F]"}`}>
              {(editedContent || "This file is empty.").split("\n").map((line, index) => <div key={index} className={`grid min-w-max grid-cols-[3.5rem_1fr] pr-8 ${theme === "dark" ? "hover:bg-white/[0.035]" : "hover:bg-black/[0.035]"}`}><span className={`select-none border-r pr-4 text-right ${theme === "dark" ? "border-white/[0.08] text-[#7D8590]" : "border-black/[0.08] text-[#92948A]"}`}>{index + 1}</span><span className="whitespace-pre pl-6 sm:pl-8">{line || " "}</span></div>)}
            </div>
            {canManageRepository && <details className="border-t border-[#E5E7EC]">
              <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-[#666B63]">Edit file</summary>
              <textarea value={editedContent} onChange={(event) => setEditedContent(event.target.value)} spellCheck="false" className="min-h-64 w-full resize-y border-t border-[#E5E7EC] bg-white p-4 font-mono text-sm leading-6 text-[#30332F] outline-none" placeholder="File content..." />
            </details>}
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-xl border border-[#E5E7EC] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EC] bg-[#FAF8F1] px-5 py-4">
                <div className="flex items-center gap-3"><span className="rounded-md bg-[#F0F1F4] px-3 py-1.5 text-sm font-semibold text-[#4F574F]">main</span><span className="text-sm font-semibold text-[#30332F]">{repository?.name}</span></div>
                <span className="text-xs text-[#92948A]">{files.length} {files.length === 1 ? "file" : "files"}</span>
              </div>
              {commits[0] && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E7EC] px-5 py-3 text-xs"><span className="font-medium text-[#5B6058]">{user?.fullName || user?.email} <span className="ml-2 font-normal text-[#777B72]">{commits[0].message}</span></span><span className="text-[#92948A]">{new Date(commits[0].createdAt).toLocaleString()}</span></div>}
              <div className="border-b border-[#E5E7EC] px-5 py-2 text-xs font-semibold uppercase tracking-wide text-[#92948A]">Repository files</div>
              {files.length ? <div className="divide-y divide-[#E5E7EC]"><DirectoryTree files={files} selectedFileId={null} onFileSelect={openFile} /></div> : <div className="px-5 py-12 text-center"><p className="text-sm text-[#92948A]">No files in this repository yet.</p>{canManageRepository && <button onClick={openCreateFileModal} className="mt-4 rounded-lg bg-[#438C89] px-4 py-2 text-sm font-semibold text-white hover:bg-[#367C79]">Create first file</button>}</div>}
              {canManageRepository && <div className="flex flex-wrap gap-2 border-t border-[#E5E7EC] px-5 py-3"><button onClick={openCreateFileModal} className="rounded-md border border-[#E1E3E8] px-3 py-2 text-xs font-medium text-[#5B6058] hover:bg-[#F0F1F4]">+ New file</button><label className="cursor-pointer rounded-md border border-[#E1E3E8] px-3 py-2 text-xs font-medium text-[#5B6058] hover:bg-[#F0F1F4]">{uploading ? "Uploading…" : "Upload files"}<input type="file" multiple className="hidden" onChange={handleUploadFile} disabled={uploading}/></label><label className="cursor-pointer rounded-md border border-[#E1E3E8] px-3 py-2 text-xs font-medium text-[#5B6058] hover:bg-[#F0F1F4]">Upload folder<input type="file" className="hidden" webkitdirectory="true" directory="true" multiple onChange={handleUploadFile} disabled={uploading}/></label></div>}
            </section>
            {readmeFile && <section className="mt-6 overflow-hidden rounded-xl border border-[#E5E7EC] bg-white">
              <div className="border-b border-[#E5E7EC] px-5 py-4"><h2 className="font-semibold text-[#30332F]">README.md</h2></div>
              <div className="space-y-3 px-6 py-6 text-sm leading-7 text-[#4F574F]">{(readmeFile.content || "README is empty.").split("\n").map((line, index) => line.startsWith("# ") ? <h2 key={index} className="text-2xl font-bold text-[#30332F]">{line.slice(2)}</h2> : line.startsWith("## ") ? <h3 key={index} className="pt-2 text-xl font-semibold text-[#30332F]">{line.slice(3)}</h3> : /^[-*] /.test(line) ? <p key={index} className="pl-5">• {line.slice(2)}</p> : line.trim() ? <p key={index}>{line}</p> : null)}</div>
            </section>}
          </>
        )}

        <div className="mt-5 rounded-xl border border-[#E5E7EC] bg-white px-5 py-4">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>

              <p className="text-sm font-medium text-[#5B6058]">
                Latest commit
              </p>

              {commits.length > 0 ? (
                <>
                  <p className="mt-1 text-sm text-[#666B63]">
                    {commits[0].message}
                  </p>

                  <p className="mt-1 text-xs text-[#92948A]">
                    {new Date(commits[0].createdAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-[#92948A]">
                  No commits yet
                </p>
              )}

            </div>

            {canManageRepository && <button
              onClick={() => {
                setError("");
                setCommitMessage("");
                setCommitModalOpen(true);
              }}
              className="rounded-lg border border-[#E1E3E8] px-4 py-2 text-sm text-[#666B63] transition hover:bg-[#F0F1F4] hover:text-[#4F574F]"
            >
              Commit Changes
            </button>}

          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#E5E7EC] bg-white">

          <div className="border-b border-[#E5E7EC] px-5 py-4">

            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#666B63]">
              Commit History
            </h2>

            <p className="mt-1 text-xs text-[#92948A]">
              {commits.length}{" "}
              {commits.length === 1 ? "commit" : "commits"}
            </p>

          </div>

          {commits.length === 0 ? (

            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[#92948A]">
                No commits yet
              </p>
            </div>

          ) : (

            <>
              <div className="max-h-[350px] overflow-y-auto">

                <div className="divide-y divide-[#E5E7EC]">

                  {(showAllCommits
                    ? commits
                    : commits.slice(0, 3)
                  ).map((commit) => (

                    <div
                      key={commit.id}
                      className="px-5 py-4 transition hover:bg-[#FAF8F1]"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div className="min-w-0">

                          <p className="font-medium text-[#4F574F]">
                            {commit.message}
                          </p>

                          <p className="mt-1 text-xs text-[#92948A]">
                            {new Date(commit.createdAt).toLocaleString()}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-md bg-[#FAF8F1] px-2 py-1 font-mono text-xs text-[#92948A]">
                          {commit.id}
                        </span>

                      </div>

                      {commit.parentId && (

                        <p className="mt-2 text-xs text-[#92948A]">
                          Parent:{" "}
                          <span className="font-mono">
                            {commit.parentId}
                          </span>
                        </p>

                      )}

                    </div>

                  ))}

                </div>
              </div>

              {commits.length > 3 && (

                <div className="border-t border-[#E5E7EC] px-5 py-4 text-center">

                  <button
                    onClick={() =>
                      setShowAllCommits((current) => !current)
                    }
                    className="rounded-lg border border-[#D4D7DD]/70 bg-[#D4D7DD]/5 px-5 py-2 text-sm font-medium text-[#697586] transition hover:bg-[#D4D7DD]/10 hover:text-[#727F8F]"
                  >
                    {showAllCommits
                      ? "View Less ↑"
                      : "View More ↓"}
                  </button>

                </div>

              )}

            </>

          )}

        </div>

      </div>

      {createModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#687B65]/35 px-4">

          <div className="w-full max-w-lg rounded-2xl border border-[#E5E7EC] bg-white p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-semibold">
                Create File
              </h2>

              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-xl text-[#777B72] hover:text-[#4F574F]"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreateFile}
              className="mt-6 space-y-5"
            >

              <div>

                <label className="mb-2 block text-sm font-medium text-[#5B6058]">
                  File Name
                </label>

                <input
                  type="text"
                  value={newFile.name}
                  onChange={(event) =>
                    setNewFile({
                      ...newFile,
                      name: event.target.value,
                    })
                  }
                  placeholder="README.md"
                  className="w-full rounded-lg border border-[#E1E3E8] bg-[#FAF8F1] px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#B7C0CB]"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-[#5B6058]">
                  File Path
                </label>

                <input
                  type="text"
                  value={newFile.path}
                  onChange={(event) =>
                    setNewFile({
                      ...newFile,
                      path: event.target.value,
                    })
                  }
                  placeholder="src/index.js"
                  className="w-full rounded-lg border border-[#E1E3E8] bg-[#FAF8F1] px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#B7C0CB]"
                />

                <p className="mt-2 text-xs text-[#92948A]">
                  Example: src/components/App.jsx
                </p>

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-[#5B6058]">
                  Initial Content
                </label>

                <textarea
                  value={newFile.content}
                  onChange={(event) =>
                    setNewFile({
                      ...newFile,
                      content: event.target.value,
                    })
                  }
                  placeholder="Enter file contents..."
                  rows="8"
                  className="w-full resize-none rounded-lg border border-[#E1E3E8] bg-[#FAF8F1] px-4 py-3 font-mono text-sm text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#B7C0CB]"
                />

              </div>

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-[#E1E3E8] px-4 py-2 text-sm text-[#5B6058] hover:bg-[#F0F1F4]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-[#E0E4EA] px-5 py-2 text-sm font-medium text-[#4F574F] hover:bg-[#B0BEAD]"
                >
                  Create File
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {commitModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#687B65]/35 px-4">

          <div className="w-full max-w-md rounded-2xl border border-[#E5E7EC] bg-white p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-semibold text-[#4F574F]">
                Commit Changes
              </h2>

              <button
                onClick={() => setCommitModalOpen(false)}
                className="text-xl text-[#777B72] hover:text-[#4F574F]"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreateCommit}
              className="mt-6 space-y-5"
            >

              <div>

                <label className="mb-2 block text-sm font-medium text-[#5B6058]">
                  Commit Message
                </label>

                <input
                  type="text"
                  value={commitMessage}
                  onChange={(event) =>
                    setCommitMessage(event.target.value)
                  }
                  placeholder="Describe your changes..."
                  className="w-full rounded-lg border border-[#E1E3E8] bg-[#FAF8F1] px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#B7C0CB]"
                />

              </div>

              <div className="rounded-lg border border-[#E5E7EC] bg-[#FAF8F1] p-4">

                <p className="text-xs uppercase tracking-wider text-[#92948A]">
                  Snapshot
                </p>

                <p className="mt-2 text-sm text-[#666B63]">
                  This commit will store the current state of{" "}
                  <span className="text-[#4F574F]">
                    {files.length}
                  </span>{" "}
                  {files.length === 1 ? "file" : "files"}.
                </p>

              </div>

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => setCommitModalOpen(false)}
                  className="rounded-lg border border-[#E1E3E8] px-4 py-2 text-sm text-[#5B6058] hover:bg-[#F0F1F4]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={committing}
                  className="rounded-lg bg-[#E0E4EA] px-5 py-2 text-sm font-medium text-[#4F574F] hover:bg-[#B0BEAD] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {committing ? "Committing..." : "Create Commit"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>
  );
}

export default RepositoryWorkspace;
