import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";

import {
  getRepository,
  getFiles,
  createFile,
  updateFile,
  deleteFile,
  getCommits,
  createCommit,
  generateAndSaveSecurityReport,
} from "../services/api";

import DirectoryTree from "../components/DirectoryTree";
import UserAvatar from "../components/UserAvatar";
import RepositorySecurityReport from "../components/RepositorySecurityReport";
import ReadmePreview from "../components/ReadmePreview";

function RepositoryWorkspace({ user, onUserUpdate, onSignOut }) {
  const { id } = useParams();

  const [repository, setRepository] = useState(null);
  const canManageRepository = user?.role === "admin" || repository?.ownerId === user?.id;
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [editedContent, setEditedContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
  const lineGutterRef = useRef(null);
  const folderPaths = files.flatMap((file) => {
    const parts = (file.path || "").split("/").filter(Boolean).slice(0, -1);
    return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
  });
  const folderCount = new Set(folderPaths).size;
  const totalBytes = files.reduce((total, file) => total + Number(file.size || (file.content || "").length), 0);
  const sizeLabel = totalBytes >= 1024 * 1024 ? (totalBytes / (1024 * 1024)).toFixed(1) + " MB" : Math.max(1, Math.round(totalBytes / 1024)) + " KB";
  const readmeFile = files.find((file) => file.path?.toLowerCase() === "readme.md");

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
    if (!commitMessage.trim()) { setError("Commit message is required."); return; }

    setCommitting(true);
    setError("");
    setNotice("");
    let reportWarning = "";
    try {
      try {
        const generated = await generateAndSaveSecurityReport(id, repository?.name || "Repository", commitMessage.trim());
        setFiles((current) => {
          const withoutOldReport = current.filter((file) => file.path !== generated.file.path);
          return [...withoutOldReport, generated.file].sort((a, b) => a.path.localeCompare(b.path));
        });
      } catch (reportError) {
        reportWarning = reportError.message || "The automatic report could not be generated.";
      }

      const response = await createCommit(id, commitMessage.trim());
      setCommits((current) => [response.data, ...current]);
      setCommitMessage("");
      setCommitModalOpen(false);
      if (reportWarning) setError("Commit created, but the automatic report could not be updated: " + reportWarning);
      else setNotice("Commit created. HAKI_SECURITY_REPORT.md was updated in this repository.");
    } catch (commitError) {
      console.error("Failed to create commit:", commitError);
      setError(commitError.message || "Failed to create commit.");
    } finally {
      setCommitting(false);
    }
  }
  async function loadWorkspace() {
    try {
      setLoading(true);
      setError("");

      const repositoryResponse = await getRepository(id);
      const filesResponse = await getFiles(id);
      const commitsResponse = await getCommits(id);

      setRepository(repositoryResponse.data);
      setFiles(filesResponse.data);
      setCommits(commitsResponse.data);

      if (filesResponse.data.length > 0) {
        setSelectedFile(filesResponse.data[0]);
        setEditedContent(
          filesResponse.data[0].content || ""
        );
      } else {
        setSelectedFile(null);
        setEditedContent("");
      }
    } catch (error) {
      console.error("Failed to load repository:", error);

      setError(
        error.message || "Failed to load repository."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [id]);

  useEffect(() => {
    if (selectedFile) {
      setEditedContent(selectedFile.content || "");
    }
  }, [selectedFile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] text-[#302D3B]">
        <div className="flex min-h-[80vh] items-center justify-center">
          <p className="text-[#827C89]">
            Loading repository...
          </p>
        </div>
      </div>
    );
  }

  if (error && !repository) {
    return (
      <div className="min-h-screen bg-[#FFF8F1] text-[#302D3B]">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <div className="rounded-lg border border-[#E5BEBB] bg-[#FBE3DF] px-4 py-3 text-[#9B5555]">
            {error}
          </div>

          <Link
            to="/"
            className="mt-6 inline-block text-sm text-[#7581AA] hover:text-[#818BAF]"
          >
            ← Back to repositories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#302D3B]">

      <div className="border-b border-[#E8D9DE] bg-[#FFF8F1]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">

          <div>
            <div className="flex items-center gap-3">
              <Link
                to="/"
                className="text-sm text-[#827C89] transition hover:text-[#302D3B]"
              >
                Repositories
              </Link>

              <span className="text-[#A49DA8]">/</span>

              <h1 className="text-xl font-bold">
                {repository?.name}
              </h1>
              <span className="rounded-full border border-[#DCD2DC] bg-white px-2.5 py-1 text-xs font-semibold text-[#706B79]">
                {repository?.visibility === "public" ? "🌐 Public" : "🔒 Private"}
              </span>
            </div>

            <p className="mt-1 text-sm text-[#827C89]">
              {repository?.description || "No description"}
            </p>
          </div>

          <div className="flex items-center gap-3">

            <UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-9 w-9" />

            <span className="rounded-full bg-[#F0E8EC] px-4 py-2 text-sm text-[#514D5A]">
              main
            </span>

            <button onClick={onSignOut} title={`Signed in as ${user?.email || ""}`} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-sm text-[#514D5A] transition hover:bg-[#F0E8EC] hover:text-[#302D3B]">
              {user?.role === "admin" ? "Admin · Sign out" : "Sign out"}
            </button>

            {canManageRepository && <button
              onClick={openCreateFileModal}
              className="rounded-lg border border-[#DCD2DC] px-4 py-2 text-sm font-medium text-[#514D5A] transition hover:bg-[#F0E8EC] hover:text-[#302D3B]"
            >
              + New File
            </button>}

            {canManageRepository && <label className="cursor-pointer rounded-lg bg-[#B9BFDD] px-4 py-2 text-sm font-medium text-[#302D3B] transition hover:bg-[#A6AED1]">
              {uploading ? "Uploading..." : "⬆ Upload File"}

              <input
                type="file"
                accept="*/*"
                className="hidden"
                onChange={handleUploadFile}
                disabled={uploading}
              />
            </label>}

            {canManageRepository && <label className="cursor-pointer rounded-lg border border-[#DCD2DC] px-4 py-2 text-sm font-medium text-[#514D5A] transition hover:bg-[#F0E8EC] hover:text-[#302D3B]">
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
          <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-[#E5BEBB] bg-[#FBE3DF] px-4 py-3 text-sm text-[#9B5555]">
            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="text-lg hover:text-[#302D3B]"
            >
              ×
            </button>
          </div>
        )}

        {notice && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
        <section className="mb-5 overflow-hidden rounded-xl border border-[#E8D9DE] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8D9DE] px-5 py-4">
            <div><h2 className="font-semibold">Repository overview</h2><p className="mt-1 text-sm text-[#827C89]">{repository?.description || "Browse the complete file tree and inspect code."}</p></div>
            <span className="rounded-full bg-[#F0E8EC] px-3 py-1.5 text-xs font-semibold text-[#514D5A]">{repository?.defaultBranch || "main"} branch</span>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-[#E8D9DE] sm:grid-cols-4 sm:divide-y-0">
            <div className="px-5 py-4"><p className="text-xs uppercase tracking-wide text-[#958F9B]">Files</p><p className="mt-1 text-2xl font-bold">{files.length}</p></div>
            <div className="px-5 py-4"><p className="text-xs uppercase tracking-wide text-[#958F9B]">Folders</p><p className="mt-1 text-2xl font-bold">{folderCount}</p></div>
            <div className="px-5 py-4"><p className="text-xs uppercase tracking-wide text-[#958F9B]">Commits</p><p className="mt-1 text-2xl font-bold">{commits.length}</p></div>
            <div className="px-5 py-4"><p className="text-xs uppercase tracking-wide text-[#958F9B]">Workspace size</p><p className="mt-1 text-2xl font-bold">{files.length ? sizeLabel : "0 KB"}</p></div>
          </div>
          {commits[0] && <div className="border-t border-[#E8D9DE] px-5 py-3 text-sm"><span className="font-medium">Latest commit:</span> <span className="text-[#706B79]">{commits[0].message}</span> <span className="ml-2 text-xs text-[#958F9B]">{new Date(commits[0].createdAt).toLocaleString()}</span></div>}
        </section>
        <RepositorySecurityReport repositoryId={id} repositoryName={repository?.name || "Repository"} files={files} onReportSaved={(savedFile) => setFiles((current) => [...current.filter((file) => file.path !== savedFile.path), savedFile].sort((a, b) => a.path.localeCompare(b.path)))} />
        <div className="grid min-h-[600px] overflow-hidden rounded-xl border border-[#E8D9DE] bg-white md:grid-cols-[280px_1fr]">

          <aside className="border-b border-[#E8D9DE] bg-[#FFF8F1] md:border-b-0 md:border-r">

            <div className="border-b border-[#E8D9DE] px-5 py-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#706B79]">
                Files
              </h2>

              <p className="mt-1 text-xs text-[#958F9B]">
                {files.length}{" "}
                {files.length === 1 ? "file" : "files"}
              </p>
            </div>

            <div className="p-3">

              <DirectoryTree
                files={files}
                selectedFileId={selectedFile?.id}
                onFileSelect={(file) => {
                  setSelectedFile(file);
                  setEditedContent(file.content || "");
                }}
              />

              {files.length === 0 && (
                <div className="px-3 py-10 text-center">

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E8D9DE] bg-white text-2xl">
                    📂
                  </div>

                  <h3 className="mt-5 text-sm font-semibold text-[#514D5A]">
                    No files yet
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-[#958F9B]">
                    {canManageRepository ? "Create a new file or upload a file from your computer." : "This repository does not contain any files yet."}
                  </p>

                  {canManageRepository && <div className="mt-5 flex flex-col gap-2">

                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#B9BFDD] px-4 py-2.5 text-sm font-medium text-[#302D3B] transition hover:bg-[#A6AED1]">
                      ⬆ Upload File

                      <input
                        type="file"
                        accept="*/*"
                        className="hidden"
                        onChange={handleUploadFile}
                        disabled={uploading}
                      />
                    </label>

                    <button
                      onClick={openCreateFileModal}
                      className="rounded-lg border border-[#E8D9DE] px-4 py-2.5 text-sm text-[#7581AA] transition hover:bg-white hover:text-[#818BAF]"
                    >
                      + Create File
                    </button>

                  </div>}
                </div>
              )}

            </div>
          </aside>

          <main className="flex min-w-0 flex-col">

            {selectedFile ? (
              <>

                <div className="flex items-center justify-between border-b border-[#E8D9DE] px-6 py-4">

                  <div className="min-w-0">

                    <h2 className="truncate font-semibold text-[#302D3B]">
                      {selectedFile.name}
                    </h2>

                    <p className="mt-1 truncate text-xs text-[#958F9B]">
                      {selectedFile.path}
                    </p>

                  </div>

                  <div className="ml-4 flex shrink-0 items-center gap-3">

                    {canManageRepository && <button
                      onClick={handleDeleteFile}
                      className="rounded-lg border border-[#E5BEBB] px-4 py-2 text-sm font-medium text-[#9B5555] transition hover:bg-[#FBE3DF]"
                    >
                      Delete
                    </button>}

                    {canManageRepository && <button
                      onClick={handleSaveFile}
                      disabled={saving}
                      className="rounded-lg bg-[#B9BFDD] px-4 py-2 text-sm font-medium text-[#302D3B] transition hover:bg-[#A6AED1] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save File"}
                    </button>}

                  </div>
                </div>

                <div className="flex-1 bg-[#FFF8F1] p-6">

                  <div className="flex min-h-[560px] overflow-hidden rounded-lg border border-[#E8D9DE] bg-[#FFF8F1]">
                    <div ref={lineGutterRef} aria-hidden="true" className="max-h-[72vh] min-h-[560px] w-12 shrink-0 overflow-hidden border-r border-[#E8D9DE] bg-white py-4 text-right font-mono text-sm leading-7 text-[#A49DA8]">
                      {(editedContent || "").split("\n").map((_, index) => <div key={index} className="px-3">{index + 1}</div>)}
                    </div>
                    <textarea
                      value={editedContent}
                      onChange={(event) => setEditedContent(event.target.value)}
                      onScroll={(event) => { if (lineGutterRef.current) lineGutterRef.current.scrollTop = event.currentTarget.scrollTop; }}
                      readOnly={!canManageRepository}
                      spellCheck="false"
                      wrap="off"
                      className="max-h-[72vh] min-h-[560px] min-w-0 flex-1 resize-none overflow-auto bg-transparent p-4 font-mono text-sm leading-7 text-[#514D5A] outline-none focus:bg-white read-only:cursor-default"
                      placeholder="File content..."
                    />
                  </div>

                </div>

              </>
            ) : (

              <div className="flex flex-1 items-center justify-center p-10 text-center">

                <div>

                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#E8D9DE] bg-white text-2xl">
                    ⬆
                  </div>

                  <h2 className="mt-5 text-lg font-semibold">
                    Upload a file
                  </h2>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#827C89]">
                    {canManageRepository ? "Select a file from your computer to add it to this repository." : "Choose a file from the list to view it."}
                  </p>

                  {canManageRepository && <label className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#B9BFDD] px-5 py-3 text-sm font-medium text-[#302D3B] transition hover:bg-[#A6AED1]">
                    ⬆ Upload File

                    <input
                      type="file"
                      accept="*/*"
                      className="hidden"
                      onChange={handleUploadFile}
                      disabled={uploading}
                    />
                  </label>}

                  <p className="mt-3 text-xs text-[#958F9B]">
                    HTML, CSS, JS, JSX, JSON, SVG, Markdown, TXT and XML supported
                  </p>

                </div>
              </div>
            )}

          </main>
        </div>

        {readmeFile && <ReadmePreview content={readmeFile.content} repositoryName={repository?.name || "Repository"} />}
        <div className="mt-5 rounded-xl border border-[#E8D9DE] bg-white px-5 py-4">

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

            <div>

              <p className="text-sm font-medium text-[#514D5A]">
                Latest commit
              </p>

              {commits.length > 0 ? (
                <>
                  <p className="mt-1 text-sm text-[#706B79]">
                    {commits[0].message}
                  </p>

                  <p className="mt-1 text-xs text-[#958F9B]">
                    {new Date(commits[0].createdAt).toLocaleString()}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-[#958F9B]">
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
              className="rounded-lg border border-[#DCD2DC] px-4 py-2 text-sm text-[#706B79] transition hover:bg-[#F0E8EC] hover:text-[#302D3B]"
            >
              Commit Changes
            </button>}

          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-[#E8D9DE] bg-white">

          <div className="border-b border-[#E8D9DE] px-5 py-4">

            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#706B79]">
              Commit History
            </h2>

            <p className="mt-1 text-xs text-[#958F9B]">
              {commits.length}{" "}
              {commits.length === 1 ? "commit" : "commits"}
            </p>

          </div>

          {commits.length === 0 ? (

            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[#958F9B]">
                No commits yet
              </p>
            </div>

          ) : (

            <>
              <div className="max-h-[350px] overflow-y-auto">

                <div className="divide-y divide-[#E8D9DE]">

                  {(showAllCommits
                    ? commits
                    : commits.slice(0, 3)
                  ).map((commit) => (

                    <div
                      key={commit.id}
                      className="px-5 py-4 transition hover:bg-[#FFF8F1]"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                        <div className="min-w-0">

                          <p className="font-medium text-[#302D3B]">
                            {commit.message}
                          </p>

                          <p className="mt-1 text-xs text-[#958F9B]">
                            {new Date(commit.createdAt).toLocaleString()}
                          </p>

                        </div>

                        <span className="shrink-0 rounded-md bg-[#FFF8F1] px-2 py-1 font-mono text-xs text-[#958F9B]">
                          {commit.id}
                        </span>

                      </div>

                      {commit.parentId && (

                        <p className="mt-2 text-xs text-[#A49DA8]">
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

                <div className="border-t border-[#E8D9DE] px-5 py-4 text-center">

                  <button
                    onClick={() =>
                      setShowAllCommits((current) => !current)
                    }
                    className="rounded-lg border border-[#A9B9D3]/70 bg-[#A9B9D3]/5 px-5 py-2 text-sm font-medium text-[#7187AC] transition hover:bg-[#A9B9D3]/10 hover:text-[#8293B2]"
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

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">

          <div className="w-full max-w-lg rounded-2xl border border-[#E8D9DE] bg-white p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-semibold">
                Create File
              </h2>

              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-xl text-[#827C89] hover:text-[#302D3B]"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreateFile}
              className="mt-6 space-y-5"
            >

              <div>

                <label className="mb-2 block text-sm font-medium text-[#514D5A]">
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
                  className="w-full rounded-lg border border-[#DCD2DC] bg-[#FFF8F1] px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#AEB6D8]"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-[#514D5A]">
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
                  className="w-full rounded-lg border border-[#DCD2DC] bg-[#FFF8F1] px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#AEB6D8]"
                />

                <p className="mt-2 text-xs text-[#958F9B]">
                  Example: src/components/App.jsx
                </p>

              </div>

              <div>

                <label className="mb-2 block text-sm font-medium text-[#514D5A]">
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
                  className="w-full resize-none rounded-lg border border-[#DCD2DC] bg-[#FFF8F1] px-4 py-3 font-mono text-sm text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#AEB6D8]"
                />

              </div>

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-lg border border-[#DCD2DC] px-4 py-2 text-sm text-[#514D5A] hover:bg-[#F0E8EC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-lg bg-[#B9BFDD] px-5 py-2 text-sm font-medium text-[#302D3B] hover:bg-[#A6AED1]"
                >
                  Create File
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {commitModalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">

          <div className="w-full max-w-md rounded-2xl border border-[#E8D9DE] bg-white p-6 shadow-2xl">

            <div className="flex items-center justify-between">

              <h2 className="text-xl font-semibold text-[#302D3B]">
                Commit Changes
              </h2>

              <button
                onClick={() => setCommitModalOpen(false)}
                className="text-xl text-[#827C89] hover:text-[#302D3B]"
              >
                ×
              </button>

            </div>

            <form
              onSubmit={handleCreateCommit}
              className="mt-6 space-y-5"
            >

              <div>

                <label className="mb-2 block text-sm font-medium text-[#514D5A]">
                  Commit Message
                </label>

                <input
                  type="text"
                  value={commitMessage}
                  onChange={(event) =>
                    setCommitMessage(event.target.value)
                  }
                  placeholder="Describe your changes..."
                  className="w-full rounded-lg border border-[#DCD2DC] bg-[#FFF8F1] px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#AEB6D8]"
                />

              </div>

              <div className="rounded-lg border border-[#E8D9DE] bg-[#FFF8F1] p-4">

                <p className="text-xs uppercase tracking-wider text-[#958F9B]">
                  Snapshot
                </p>

                <p className="mt-2 text-sm text-[#706B79]">
                  This commit will store the current state of{" "}
                  <span className="text-[#302D3B]">
                    {files.length}
                  </span>{" "}
                  {files.length === 1 ? "file" : "files"}.
                </p>

              </div>

              <div className="flex justify-end gap-3">

                <button
                  type="button"
                  onClick={() => setCommitModalOpen(false)}
                  className="rounded-lg border border-[#DCD2DC] px-4 py-2 text-sm text-[#514D5A] hover:bg-[#F0E8EC]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={committing}
                  className="rounded-lg bg-[#B9BFDD] px-5 py-2 text-sm font-medium text-[#302D3B] hover:bg-[#A6AED1] disabled:cursor-not-allowed disabled:opacity-50"
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
