import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, FolderGit2, Globe2, LockKeyhole, Search, Users } from "lucide-react";

import {
  getRepositories,
  getGitHubRepositories,
  createRepository,
  updateRepository,
  deleteRepository,
} from "../services/api";

import RepositoryCard from "../components/RepositoryCard";
import RepositoryModal from "../components/RepositoryModal";
import UserAvatar from "../components/UserAvatar";

function Dashboard({ user, onUserUpdate, onSignOut }) {
  const navigate = useNavigate();

  const [repositories, setRepositories] = useState([]);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [githubError, setGithubError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRepository, setEditingRepository] = useState(null);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "private",
  });

  const visibleRepositories = repositories.filter((repository) => `${repository.name} ${repository.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  const publicCount = repositories.filter((repository) => repository.visibility === "public").length;
  const privateCount = repositories.length - publicCount;

  async function loadRepositories() {
    try {
      setLoading(true);
      setError("");

      const response = await getRepositories();
      setRepositories(response.data);
      try {
        const githubResponse = await getGitHubRepositories();
        setGithubRepositories(githubResponse.data);
        setGithubError("");
      } catch (githubLoadError) {
        setGithubRepositories([]);
        setGithubError(githubLoadError.message || "GitHub repositories could not be loaded.");
      }
    } catch (error) {
      setError(error.message || "Failed to load repositories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepositories();
  }, []);

  function openCreateModal() {
    setEditingRepository(null);
    setForm({
      name: "",
      description: "",
      visibility: "private",
    });

    setError("");
    setModalOpen(true);
  }

  function openEditModal(repository) {
    setEditingRepository(repository);

    setForm({
      name: repository.name,
      description: repository.description || "",
      visibility: repository.visibility || "private",
    });

    setError("");
    setModalOpen(true);
  }

  async function handleSubmit() {
    try {
      if (!form.name.trim()) {
        setError("Repository name is required.");
        return;
      }

      setError("");

      if (editingRepository) {
        await updateRepository(editingRepository.id, {
          name: form.name.trim(),
          description: form.description.trim(),
          visibility: form.visibility,
        });
      } else {
        await createRepository({
          name: form.name.trim(),
          description: form.description.trim(),
          visibility: form.visibility,
        });
      }

      setModalOpen(false);
      await loadRepositories();
    } catch (error) {
      setError(error.message || "Repository operation failed.");
    }
  }

  async function handleDelete(repository) {
    const confirmed = window.confirm(
      `Delete repository "${repository.name}"?`
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteRepository(repository.id);
      await loadRepositories();
    } catch (error) {
      setError(error.message || "Failed to delete repository.");
    }
  }

  function handleOpen(repository) {
    navigate(`/repositories/${repository.id}`);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FFF8F1] text-[#302D3B]">

      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="absolute -left-40 top-40 h-[520px] w-[520px] rounded-full border-[70px] border-[#C3C6DF]/50 blur-sm" />

        <div className="absolute -right-60 top-[-180px] h-[620px] w-[620px] rounded-full border-[90px] border-[#E8D9DE] blur-sm" />

        <div className="absolute left-1/3 top-0 h-96 w-96 rounded-full bg-[#B9BFDD]/10 blur-[120px]" />

        <div className="absolute bottom-0 right-0 h-[450px] w-[450px] rounded-full bg-[#C3C6DF]/20 blur-[130px]" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#FFF8F1_90%)]" />

      </div>

      <header className="relative z-10 border-b border-white/[0.08] bg-[#FFF8F1]/90 backdrop-blur-2xl">

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-5 sm:px-8">

          <div className="flex items-center gap-3">

            <Link
              to="/"
              className="group flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[#E8D9DE] bg-white shadow-[0_0_25px_rgba(6,182,212,0.08)] transition duration-300 hover:scale-105 hover:border-[#A9B9D3] hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]"
            >
              <img
                src="/logo.png"
                alt="HAKI"
                className="h-full w-full object-contain"
              />
            </Link>

            <div>
              <h1 className="text-xl font-bold tracking-wide text-[#302D3B]">
                HAKI
              </h1>

              <p className="text-xs font-medium text-[#827C89]">
                Version Control System
              </p>
            </div>

          </div>

          <nav aria-label="Workspace" className="hidden items-center gap-1 lg:flex">
            <Link to="/setting" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">Settings</Link>
            <Link to="/import" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">Import</Link>
            <Link to="/about" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">About</Link>
          </nav>

          <div className="flex max-w-full items-center gap-2 rounded-full border border-[#E8D9DE] bg-white px-2.5 py-2 sm:gap-3 sm:px-4">

            <span className="h-2 w-2 animate-pulse rounded-full bg-[#A8B9AD] shadow-[0_0_12px_#34d399]" />

            <UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-9 w-9" />

            <span className="hidden max-w-36 truncate text-sm font-medium text-[#706B79] sm:block">{user?.fullName || user?.email}</span>
            <span className="rounded-full bg-[#EAD9DF] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#655469] sm:px-2.5 sm:text-[10px]">{user?.role === "admin" ? "Admin" : "Member"}</span>
            <button onClick={onSignOut} className="shrink-0 text-xs font-semibold text-[#706B79] transition hover:text-[#302D3B]">Sign out</button>

          </div>

          <nav aria-label="Workspace" className="flex basis-full gap-1 overflow-x-auto whitespace-nowrap pb-1 lg:hidden">
            <Link to="/teams" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">Teams</Link>
            <Link to="/setting" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">Settings</Link>
            <Link to="/import" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">Import</Link>
            <Link to="/about" className="rounded-lg px-3 py-2 text-sm font-medium text-[#706B79] hover:bg-white">About</Link>
          </nav>

        </div>

      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">

        <section className="mb-8 overflow-hidden rounded-3xl border border-[#E8D9DE] bg-gradient-to-br from-[#FFF0DF] via-[#FBE3DF] to-[#C3C6DF] p-7 shadow-[0_0_40px_rgba(15,23,42,0.14)] sm:p-9">

          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">

            <div>

              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#E8D9DE] bg-[#BFC3DF]/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#8293B2]">

                <span className="h-1.5 w-1.5 rounded-full bg-[#C3C6DF] shadow-[0_0_10px_#22d3ee]" />

                Developer Workspace

              </div>

              <h2 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-[#302D3B] sm:text-5xl">
                Your repositories<span className="text-[#7187AC]">.</span>

              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-[#706B79] sm:text-lg">

                Create and organize your projects in one place.

              </p>

            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={openCreateModal}
                className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-xl border border-[#C3C6DF] bg-[#B9BFDD] px-6 py-4 text-sm font-semibold text-[#302D3B] shadow-[0_0_30px_rgba(37,99,235,0.25)] transition duration-300 hover:-translate-y-1 hover:bg-[#AEB6D8] hover:shadow-[0_0_40px_rgba(37,99,235,0.45)]"
              >
                <span className="text-xl">+</span>
                New Repository
                <span className="transition duration-300 group-hover:translate-x-1">→</span>
              </button>
              <Link to="/teams" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#DCD2DC] bg-white/80 px-5 py-4 text-sm font-semibold text-[#514D5A] transition hover:-translate-y-1 hover:bg-white">
                <Users size={17} />Manage Teams
              </Link>
            </div>

          </div>

        </section>

        <section aria-label="Repository overview" className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Repositories", value: repositories.length, icon: FolderGit2, tint: "bg-[#E6EFFD] text-[#7187AC]" },
            { label: "Public", value: publicCount, icon: Globe2, tint: "bg-[#E8F4EC] text-[#64816D]" },
            { label: "Private", value: privateCount, icon: LockKeyhole, tint: "bg-[#F3E9F0] text-[#8B7188]" },
          ].map(({ label, value, icon: Icon, tint }) => <article key={label} className="rounded-2xl border border-[#E8D9DE] bg-white/85 p-5 shadow-sm"><div className="flex items-center justify-between"><span className={`rounded-xl p-3 ${tint}`}><Icon size={20} /></span><span className="text-xs font-medium text-[#958F9B]">LOCAL WORKSPACE</span></div><p className="mt-4 text-sm text-[#706B79]">{label}</p><p className="mt-1 text-3xl font-bold text-[#302D3B]">{String(value).padStart(2, "0")}</p></article>)}
        </section>

        {error && (

          <div className="mb-7 flex items-center justify-between gap-4 rounded-xl border border-[#E5BEBB] bg-[#FBE3DF]/70 px-5 py-4 text-sm text-[#A96060] shadow-[0_0_25px_rgba(239,68,68,0.05)]">

            <span>{error}</span>

            <button
              onClick={() => setError("")}
              className="text-xl text-[#9B5555] transition hover:text-[#302D3B]"
            >
              ×
            </button>

          </div>

        )}

        <section>

          <div className="mb-8 rounded-2xl border border-[#E8D9DE] bg-white/90 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-semibold text-[#302D3B]">GitHub repositories</h2><p className="mt-1 text-sm text-[#827C89]">Public repositories on your linked GitHub account and repositories connected to your HAKI teams. Private repositories appear only after a team GitHub App installation grants access.</p></div>
              {!githubError && <span className="rounded-full bg-[#E6EFFD] px-3 py-1 text-xs font-medium text-[#586E94]">{githubRepositories.length} found</span>}
            </div>
            {githubError ? <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#FFF8F1] px-4 py-3"><p className="text-sm text-[#827C89]">{githubError}</p><button onClick={loadRepositories} className="rounded-lg bg-[#B9BFDD] px-3 py-2 text-sm font-medium text-[#302D3B]">Retry</button></div> : githubRepositories.length === 0 ? <p className="mt-4 text-sm text-[#827C89]">No GitHub repositories found.</p> : <ul aria-label="GitHub repositories" className="mt-4 max-h-80 divide-y divide-[#F0E8EA] overflow-y-auto overscroll-contain pr-2">{githubRepositories.map((repository) => <li key={repository.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-medium text-[#302D3B]">{repository.fullName}</p><p className="mt-1 text-xs text-[#827C89]">{repository.private ? "Private" : "Public"}{repository.teamName ? ` · HAKI team ${repository.teamName}` : ""}{repository.description ? ` · ${repository.description}` : ""}</p></div><a href={repository.htmlUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-[#E8D9DE] px-3 py-2 text-sm font-medium text-[#586E94] hover:bg-[#F8F6FA]">Open on GitHub <ExternalLink size={14} /></a></li>)}</ul>}
          </div>

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-semibold text-[#302D3B]">
                Repositories
              </h2>

              {!loading && (

                <p className="mt-2 text-sm text-[#827C89]">
                  {repositories.length}{" "}
                  {repositories.length === 1
                    ? "repository"
                    : "repositories"}
                </p>

              )}

            </div>

            <label className="relative block w-full sm:w-72"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#958F9B]" /><span className="sr-only">Search repositories</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories…" className="w-full rounded-xl border border-[#E8D9DE] bg-white/85 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[#A9B9D3]" /></label>

          </div>

          {loading ? (

            <div className="grid gap-5 md:grid-cols-2">

              {[1, 2, 3, 4].map((item) => (

                <div
                  key={item}
                  className="h-52 animate-pulse rounded-2xl border border-[#E8D9DE] bg-white"
                />

              ))}

            </div>

          ) : repositories.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-[#DCD2DC] bg-white px-6 py-20 text-center shadow-[0_0_40px_rgba(15,23,42,0.2)]">

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-[#E8D9DE] bg-[#BFC3DF]/5 text-3xl shadow-[0_0_30px_rgba(6,182,212,0.08)]">
                📁
              </div>

              <h3 className="mt-6 text-xl font-semibold text-[#484451]">
                No repositories yet
              </h3>

              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#827C89]">
                Create your first HAKI repository and start managing your
                project files.
              </p>

              <button
                onClick={openCreateModal}
                className="mt-7 rounded-xl bg-[#B9BFDD] px-6 py-3 text-sm font-semibold text-[#302D3B] shadow-[0_0_25px_rgba(37,99,235,0.2)] transition duration-300 hover:bg-[#AEB6D8] hover:shadow-[0_0_35px_rgba(37,99,235,0.4)]"
              >
                Create Repository
              </button>

            </div>

          ) : (

            <div className="grid gap-5 md:grid-cols-2">

              {visibleRepositories.map((repository) => (

                <RepositoryCard
                  key={repository.id}
                  repository={repository}
                  onOpen={handleOpen}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  canManage={user?.role === "admin" || repository.ownerId === user?.id}
                />

              ))}

              {visibleRepositories.length === 0 && repositories.length > 0 && <p className="col-span-full rounded-2xl border border-[#E8D9DE] bg-white p-8 text-center text-sm text-[#827C89]">No repositories match “{search}”.</p>}

            </div>

          )}

        </section>

      </main>

      <footer className="relative z-10 mx-auto max-w-7xl border-t border-white/[0.06] px-5 py-6 text-center text-xs text-[#958F9B] sm:px-8">
        HAKI Version Control · Frontend preview · Data stays in this browser
      </footer>

      <RepositoryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        form={form}
        setForm={setForm}
        editing={Boolean(editingRepository)}
      />

    </div>
  );
}

export default Dashboard;
