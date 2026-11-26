import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FolderGit2, Globe2, LockKeyhole, Search, GitCommitHorizontal, Activity, ArrowUpRight, Moon, Sun } from "lucide-react";

import {
  getRepositories,
  getCommits,
  refreshBackendSession,
  createRepository,
  updateRepository,
  deleteRepository,
} from "../services/api";

import RepositoryCard from "../components/RepositoryCard";
import HakiLogo from "../components/HakiLogo";
import RepositoryModal from "../components/RepositoryModal";
import UserAvatar from "../components/UserAvatar";

function Dashboard({ user, onUserUpdate, onSignOut, theme, onThemeToggle }) {
  const navigate = useNavigate();

  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRepository, setEditingRepository] = useState(null);
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState([]);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const profileMenuRef = useRef(null);

  const [form, setForm] = useState({
    name: "",
    description: "",
    visibility: "private",
  });

  const visibleRepositories = repositories.filter((repository) => `${repository.name} ${repository.description || ""}`.toLowerCase().includes(search.toLowerCase()));
  const publicCount = repositories.filter((repository) => repository.visibility === "public").length;
  const privateCount = repositories.length - publicCount;
  const activityEnd = new Date();
  activityEnd.setHours(0, 0, 0, 0);
  const activityStart = new Date(activityEnd);
  activityStart.setDate(activityStart.getDate() - 364);
  activityStart.setDate(activityStart.getDate() - activityStart.getDay());
  const activityByDay = new Map();
  activity.forEach((item) => {
    const day = new Date(item.createdAt);
    const key = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
    activityByDay.set(key, (activityByDay.get(key) || 0) + 1);
  });
  const yearlyDays = Array.from({ length: Math.floor((activityEnd - activityStart) / 86400000) + 1 }, (_, index) => {
    const day = new Date(activityStart);
    day.setDate(activityStart.getDate() + index);
    const count = activityByDay.get(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()) || 0;
    return { day, count };
  });
  const monthLabels = yearlyDays.map(({ day }, index) => day.getDate() === 1 ? { label: day.toLocaleDateString(undefined, { month: "short" }), week: Math.floor(index / 7) } : null).filter(Boolean);
  const contributionTotal = yearlyDays.reduce((sum, day) => sum + day.count, 0);

  async function loadRepositories() {
    try {
      setLoading(true);
      setError("");

      let response;
      try {
        response = await getRepositories();
      } catch (loadError) {
        if (loadError.message !== "Please sign in to continue.") throw loadError;
        await refreshBackendSession();
        response = await getRepositories();
      }
      setRepositories(response.data);
      const histories = await Promise.all(response.data.map(async (repository) => {
        try {
          const result = await getCommits(repository.id);
          return result.data.map((commit) => ({ ...commit, repositoryName: repository.name, repositoryId: repository.id, kind: "commit" }));
        } catch {
          return [];
        }
      }));
      const commits = histories.flat();
      const latestRepoUpdates = response.data.map((repository) => ({
        id: `repo-${repository.id}`,
        repositoryName: repository.name,
        repositoryId: repository.id,
        message: `Repository ${repository.createdAt === repository.updatedAt ? "created" : "updated"}`,
        createdAt: repository.updatedAt || repository.createdAt,
        kind: "repository",
      }));
      setActivity([...commits, ...latestRepoUpdates].filter((item) => item.createdAt).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } catch (error) {
      setError(error.message || "Failed to load repositories.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRepositories();
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    function handleOutsideClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
        setMoreOptionsOpen(false);
      }
    }
    function handleEscape(event) {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setMoreOptionsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

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
    <div className="dashboard-shell min-h-screen bg-[#0B1020] text-[#E9ECF5]" data-theme={theme}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 self-start flex-col overflow-y-auto border-r border-white/[0.07] bg-[#0D1324] px-4 py-5 lg:flex">
          <Link to="/" className="mb-9 flex items-center gap-3 px-2">
            <HakiLogo className="h-10 w-10" />
            <span><strong className="block text-sm tracking-wide">HAKI</strong><small className="text-[10px] text-[#8994AA]">Developer workspace</small></span>
          </Link>
          <div className="mb-8 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
            <p className="text-xs font-semibold">{user?.fullName || user?.email}</p>
            <p className="mt-1 text-[10px] text-[#8994AA]">Personal workspace</p>
          </div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#66728A]">Workspace</p>
          <nav className="space-y-1" aria-label="Workspace">
            <Link to="/" className="flex items-center gap-3 rounded-lg bg-[#687386]/15 px-3 py-2.5 text-sm font-medium text-[#D0D5DE]"><FolderGit2 size={16} />Overview</Link>
            <button onClick={() => document.getElementById("repositories")?.scrollIntoView({ behavior: "smooth" })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#9AA5B8] transition hover:bg-white/[0.05] hover:text-white"><GitCommitHorizontal size={16} />Repositories<span className="ml-auto text-xs text-[#758199]">{repositories.length}</span></button>
            <button onClick={() => document.getElementById("activity-heading")?.scrollIntoView({ behavior: "smooth" })} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[#9AA5B8] transition hover:bg-white/[0.05] hover:text-white"><Activity size={16} />Activity</button>
          </nav>
          <p className="mb-2 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#66728A]">Manage</p>
          <nav className="space-y-1" aria-label="Manage workspace">
            <Link to="/import" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9AA5B8] transition hover:bg-white/[0.05] hover:text-white">Import repository</Link>
            <Link to="/setting" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9AA5B8] transition hover:bg-white/[0.05] hover:text-white">Settings</Link>
            <Link to="/about" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9AA5B8] transition hover:bg-white/[0.05] hover:text-white">About HAKI</Link>
          </nav>
          <div className="mt-auto rounded-xl border border-[#687386]/20 bg-[#687386]/[0.08] p-4">
            <p className="text-xs font-semibold text-[#D4D9E0]">Your workspace</p>
            <p className="mt-1 text-[11px] leading-5 text-[#8994AA]">{repositories.length} repositories ready to build.</p>
            <button onClick={openCreateModal} className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-[#E9ECF5] hover:bg-white/10">New repository</button>
          </div>
          <div className="relative mt-4 border-t border-white/[0.08] pt-4" ref={profileMenuRef}>
            <div className="flex items-center gap-3 rounded-xl px-2 py-2">
              <UserAvatar user={user} onUserUpdate={onUserUpdate} onClick={() => { setProfileMenuOpen((open) => !open); setMoreOptionsOpen(false); }} size="h-10 w-10" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{user?.fullName || user?.email}</span>
              <button onClick={() => { setProfileMenuOpen((open) => !open); setMoreOptionsOpen(false); }} aria-label="Open account options" aria-expanded={profileMenuOpen} className="rounded-lg px-2 py-2 text-lg leading-none text-[#AAB4C5] hover:bg-white/[0.07]">⋯</button>
            </div>
            {profileMenuOpen && <div className="absolute bottom-full left-0 z-50 mb-2 w-full rounded-xl border border-white/10 bg-[#111827] p-2 shadow-2xl">
              <p className="truncate px-3 py-2 text-xs text-[#AAB4C5]">{user?.email}</p>
              <button onClick={onSignOut} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[#E9ECF5] hover:bg-white/[0.08]">Sign out</button>
              <button onClick={() => setMoreOptionsOpen((open) => !open)} aria-expanded={moreOptionsOpen} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-[#E9ECF5] hover:bg-white/[0.08]">More options <span aria-hidden="true">{moreOptionsOpen ? "−" : "+"}</span></button>
              {moreOptionsOpen && <div className="mt-1 border-t border-white/[0.08] pt-1"><Link to="/setting" onClick={() => setProfileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-[#AAB4C5] hover:bg-white/[0.08]">Settings</Link><Link to="/about" onClick={() => setProfileMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-[#AAB4C5] hover:bg-white/[0.08]">About HAKI</Link></div>}
            </div>}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0B1020]/90 backdrop-blur-xl">
            <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 px-4 sm:px-7">
              <div className="flex items-center gap-3 lg:hidden"><HakiLogo className="h-10 w-10"/><strong>HAKI</strong></div>
              <div className="hidden text-xs text-[#8994AA] lg:block">Workspace <span className="mx-2 text-[#4D5870]">/</span><span className="text-[#E9ECF5]">Overview</span></div>
              <label className="relative order-3 w-full sm:order-none sm:ml-auto sm:w-72"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#748098]"/><span className="sr-only">Search repositories</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search repositories…" className="w-full rounded-lg border border-white/[0.09] bg-white/[0.035] py-2 pl-9 pr-3 text-xs text-[#E9ECF5] outline-none placeholder:text-[#748098] focus:border-[#8A95A3]" /></label>
              <div className="flex items-center gap-2 sm:gap-3"><span className="hidden text-xs text-[#8994AA] sm:block">Workspace active</span><span className="h-2 w-2 rounded-full bg-[#8294A5] shadow-[0_0_12px_#8294A5]"/><span className="lg:hidden"><UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-8 w-8"/></span><button onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="theme-toggle rounded-lg border border-white/[0.09] p-2 text-[#B8C1D1] hover:bg-white/[0.06]">{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button><button onClick={onSignOut} className="rounded-lg border border-white/[0.09] px-3 py-2 text-xs font-medium text-[#B8C1D1] hover:bg-white/[0.05] lg:hidden">Sign out</button></div>
            </div>
          </header>

          <main className="page-enter mx-auto max-w-[1500px] px-4 py-7 sm:px-7 sm:py-9">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#B7C0CC]">Workspace overview</p><h1 className="dashboard-welcome-title text-3xl font-extrabold tracking-tight sm:text-4xl">Good to see you, <span className="dashboard-welcome-name">{user?.fullName?.split(" ")[0] || "developer"}</span></h1><p className="mt-2 text-base text-[#8994AA]">Everything you’re building, moving forward.</p></div>
              <button onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-lg bg-[#687386] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#687386]/20 transition hover:-translate-y-0.5 hover:bg-[#7A8698]"><span className="text-lg leading-none">+</span>New repository</button>
            </div>

            {error && <div role="alert" className="mb-6 flex items-center justify-between rounded-xl border border-[#987A68]/30 bg-[#987A68]/10 px-4 py-3 text-sm text-[#D7BCA8]"><span>{error}</span><button onClick={() => setError("")} className="px-2 text-lg">×</button></div>}

            <section className="yearly-activity mb-6 rounded-xl border border-white/[0.075] bg-[#111827] p-5" aria-label="Daily contribution activity for the last year">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-semibold">Activity</h2><p className="mt-1 text-sm text-[#8994AA]">Daily contributions over the last year</p></div><span className="text-sm text-[#AAB4C5]">{contributionTotal} contributions</span></div>
              <div className="overflow-x-auto py-8">
                <div className="mb-2 ml-7 grid min-w-max grid-flow-col auto-cols-[12px] gap-1 text-[10px] text-[#8994AA]">{monthLabels.map(({ label, week }, index) => <span key={`${label}-${index}`} style={{ gridColumnStart: week + 1 }}>{label}</span>)}</div>
                <div className="flex min-w-max gap-2">
                  <div className="flex h-[104px] flex-col justify-between py-0.5 text-[9px] text-[#8994AA]"><span>Mon</span><span>Wed</span><span>Fri</span></div>
                  <div className="grid grid-flow-col grid-rows-7 auto-cols-[12px] gap-1" role="img" aria-label="Daily contribution activity over the last year">{yearlyDays.map(({ day, count }) => {
                    const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : 3;
                    const colors = theme === "dark" ? ["#262626", "#294631", "#3b7047", "#5b925f"] : ["#e9e9e2", "#d8e7d5", "#a9cba8", "#668f64"];
                    return <span key={day.toISOString()} aria-label={`${day.toLocaleDateString()}: ${count} contribution${count === 1 ? "" : "s"}`} className="activity-cell group relative z-0 h-3 w-3 rounded-[3px] transition-colors hover:z-20" style={{ backgroundColor: colors[level] }}><span className="activity-tooltip pointer-events-none absolute left-0 top-full z-50 mt-1 whitespace-nowrap rounded-md bg-[#202020] px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{day.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · {count} contribution{count === 1 ? "" : "s"}</span></span>;
                  })}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3"><p className="text-xs text-[#8994AA]">Lifetime activity <strong className="ml-1 font-semibold text-[#DCE1EC]">{activity.length}</strong></p><div className="flex items-center gap-2 text-xs text-[#8994AA]"><span>Less</span>{(theme === "dark" ? ["#262626", "#294631", "#3b7047", "#5b925f"] : ["#e9e9e2", "#d8e7d5", "#a9cba8", "#668f64"]).map((color) => <i key={color} className="h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />)}<span>More</span></div></div>
            </section>

            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.85fr)]">
              <section id="repositories" className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#111827]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4"><div><h2 className="text-sm font-semibold">Repositories</h2><p className="mt-1 text-xs text-[#8994AA]">Your code, organized and always in sync.</p></div><span className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] text-[#AAB4C5]">{repositories.length}</span></div>
                {loading ? <div className="grid gap-3 p-4">{[1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-white/[0.04]"/>)}</div> : repositories.length === 0 ? <div className="px-6 py-14 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#687386]/15 text-[#B0BAC7]"><FolderGit2 size={22}/></span><h3 className="mt-4 text-sm font-semibold">No repositories yet</h3><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#8994AA]">Create your first HAKI repository and start organizing your project.</p><button onClick={openCreateModal} className="mt-5 rounded-lg bg-[#687386] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#7A8698]">Create repository</button></div> : <div className="grid gap-3 p-4 md:grid-cols-2">{visibleRepositories.map((repository) => <RepositoryCard key={repository.id} repository={repository} onOpen={handleOpen} onEdit={openEditModal} onDelete={handleDelete} canManage={user?.role === "admin" || repository.ownerId === user?.id} />)}{visibleRepositories.length === 0 && <p className="col-span-full rounded-lg border border-white/[0.08] p-7 text-center text-sm text-[#8994AA]">No repositories match “{search}”.</p>}</div>}
              </section>

              <section id="activity-heading" className="overflow-hidden rounded-xl border border-white/[0.075] bg-[#111827]" aria-labelledby="activity-title">
                <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><h2 id="activity-title" className="text-sm font-semibold">Recent activity</h2><p className="mt-1 text-xs text-[#8994AA]">Latest across your workspace</p></div><Activity size={17} className="text-[#B7C0CC]"/></div>
                {activity.length ? <ol className="divide-y divide-white/[0.055]">{activity.slice(0, 8).map((item, index) => <li key={item.id} className="activity-row flex items-start gap-3 px-5 py-4" style={{ "--item-index": index }}><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.kind === "commit" ? "bg-[#778397]/15 text-[#A9B4C3]" : "bg-[#687386]/15 text-[#B0BAC7]"}`}><GitCommitHorizontal size={16}/></span><div className="min-w-0 flex-1"><p className="break-words text-xs font-medium leading-5 text-[#DCE1EC]">{item.message}</p><button onClick={() => navigate(`/repositories/${item.repositoryId}`)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#B7C0CC] hover:text-[#E0E4E9]">{item.repositoryName}<ArrowUpRight size={11}/></button></div><time className="shrink-0 pt-1 text-[10px] text-[#748098]" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></li>)}</ol> : <div className="px-5 py-12 text-center"><GitCommitHorizontal className="mx-auto mb-3 text-[#68758C]" size={23}/><p className="text-xs font-medium">Nothing here yet</p><p className="mt-1 text-[11px] text-[#8994AA]">New commits and repository updates will appear here.</p></div>}
              </section>
            </div>
            <p className="mt-8 mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#8994AA]">Lifetime</p>
            <section aria-label="Lifetime workspace totals" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Repositories", value: repositories.length, icon: FolderGit2, accent: "text-[#B0BAC7]", tone: "bg-[#687386]/15" },
                { label: "Commits", value: activity.filter((item) => item.kind === "commit").length, icon: GitCommitHorizontal, accent: "text-[#A9B4C3]", tone: "bg-[#778397]/15" },
                { label: "Public", value: publicCount, icon: Globe2, accent: "text-[#8294A5]", tone: "bg-[#8294A5]/15" },
                { label: "Private", value: privateCount, icon: LockKeyhole, accent: "text-[#B8AEA0]", tone: "bg-[#B8AEA0]/15" },
              ].map(({ label, value, icon: Icon, accent, tone }) => <article key={label} className="rounded-xl border border-white/[0.075] bg-[#111827] p-4 transition hover:border-white/[0.14]"><div className="flex items-center justify-between"><span className={`rounded-lg p-2 ${tone} ${accent}`}><Icon size={17}/></span><span className="text-[10px] uppercase tracking-wider text-[#68758C]">All time</span></div><p className="mt-4 text-xs text-[#8994AA]">{label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{String(value).padStart(2, "0")}</p></article>)}
            </section>

            <footer className="mt-7 border-t border-white/[0.06] pt-5 text-center text-[10px] text-[#68758C]">HAKI · Version Control Workspace · Data stays in this browser</footer>
          </main>
        </div>
      </div>

      <RepositoryModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSubmit} form={form} setForm={setForm} editing={Boolean(editingRepository)} />
    </div>
  );
}

export default Dashboard;
