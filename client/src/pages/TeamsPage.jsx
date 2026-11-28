import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, ExternalLink, Plus, RefreshCw, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
import {
  changeTeamMemberRole, createTeam, getMyTeamInvitations, getTeamMembers, getTeams,
  getTeamGitHubRepositories, getTeamSettings, inviteTeamMember, leaveTeam, removeTeamMember,
  respondToTeamInvitation, transferTeamOwnership, updateTeamSettings,
  startGitHubInstallation,
} from "../services/api";

const emptySettings = { defaultBranch: "main", requireReviews: true, requiredApprovals: 1 };
const roles = ["OWNER", "ADMIN", "DEVELOPER", "REVIEWER"];
const inputClass = "w-full rounded-xl border border-[#E8D9DE] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#A9B9D3]";
const buttonClass = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#B9BFDD] px-4 py-2.5 text-sm font-semibold text-[#302D3B] transition hover:bg-[#AEB6D8] disabled:cursor-not-allowed disabled:opacity-50";

function TeamRole({ role }) {
  const Icon = role === "OWNER" ? Crown : role === "ADMIN" ? ShieldCheck : Users;
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#F1EDF4] px-2.5 py-1 text-[11px] font-semibold text-[#655469]"><Icon size={12} />{role}</span>;
}

export default function TeamsPage({ user }) {
  const [teams, setTeams] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [githubRepositories, setGithubRepositories] = useState([]);
  const [settings, setSettings] = useState(emptySettings);
  const [teamName, setTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("DEVELOPER");
  const [transferTarget, setTransferTarget] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => ["failed", "expired"].includes(new URLSearchParams(window.location.search).get("installation")) ? "GitHub App installation did not finish. Start again and complete it within 10 minutes." : "");
  const [notice, setNotice] = useState(() => new URLSearchParams(window.location.search).get("installation") === "success" ? "GitHub App connected. Its repositories are now available to this team." : "");
  const selectedTeamIdRef = useRef(null);

  const loadTeams = useCallback(async (preferredTeamId) => {
    setLoading(true);
    setError("");
    try {
      const [nextTeams, nextInvitations] = await Promise.all([getTeams(), getMyTeamInvitations()]);
      setTeams(nextTeams);
      setInvitations(nextInvitations);
      const nextSelected = nextTeams.find((team) => team.id === (preferredTeamId || selectedTeamIdRef.current)) || nextTeams[0] || null;
      selectedTeamIdRef.current = nextSelected?.id || null;
      setSelectedTeam(nextSelected);
      if (nextSelected) {
        const [nextMembers, nextSettings] = await Promise.all([getTeamMembers(nextSelected.id), getTeamSettings(nextSelected.id)]);
        setMembers(nextMembers);
        setSettings({ ...emptySettings, ...nextSettings });
      } else {
        setMembers([]);
        setSettings(emptySettings);
      }
    } catch (loadError) {
      setError(loadError.message || "Teams could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadTeams(new URLSearchParams(window.location.search).get("teamId") || undefined), 0);
    return () => window.clearTimeout(timer);
  }, [loadTeams]);

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("installation");
    if (result) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!selectedTeam?.id) return undefined;
    let active = true;
    getTeamGitHubRepositories(selectedTeam.id)
      .then((items) => { if (active) setGithubRepositories(items); })
      .catch((loadError) => { if (active) setError(loadError.message || "GitHub repositories could not be loaded."); });
    return () => { active = false; };
  }, [selectedTeam?.id]);

  async function installGitHubApp() {
    if (!selectedTeam?.id) return;
    setBusy(true); setError("");
    try {
      const result = await startGitHubInstallation(selectedTeam.id);
      window.location.assign(result.url);
    } catch (installError) {
      setError(installError.message || "GitHub App installation could not be started.");
      setBusy(false);
    }
  }

  async function runAction(action, successMessage, teamId = selectedTeam?.id) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(successMessage);
      await loadTeams(teamId);
    } catch (actionError) {
      setError(actionError.message || "The team change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateTeam(event) {
    event.preventDefault();
    if (!teamName.trim()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const created = await createTeam(teamName.trim());
      setTeamName("");
      setNotice("Team created. You are its owner.");
      await loadTeams(created.id);
    } catch (createError) {
      setError(createError.message || "The team could not be created.");
    } finally { setBusy(false); }
  }

  async function selectTeam(team) {
    selectedTeamIdRef.current = team.id;
    setSelectedTeam(team); setError(""); setNotice("");
    setLoading(true);
    try {
      const [nextMembers, nextSettings] = await Promise.all([getTeamMembers(team.id), getTeamSettings(team.id)]);
      setMembers(nextMembers);
      setSettings({ ...emptySettings, ...nextSettings });
      setTransferTarget(nextMembers.find((member) => member.status === "ACTIVE" && member.email !== user?.email)?.userId || "");
    } catch (selectError) { setError(selectError.message || "Team details could not be loaded."); }
    finally { setLoading(false); }
  }

  const activeMembers = members.filter((member) => member.status === "ACTIVE");
  const canManage = ["OWNER", "ADMIN"].includes(selectedTeam?.role);
  const isOwner = selectedTeam?.role === "OWNER";
  const currentMember = members.find((member) => member.email?.toLowerCase() === user?.email?.toLowerCase());

  return <main className="min-h-[calc(100vh-64px)] bg-[#FFF8F1] px-4 py-7 text-[#302D3B] sm:px-8 sm:py-10">
    <div className="mx-auto max-w-7xl">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8293B2]">Workspace</p><h1 className="mt-2 text-3xl font-bold">Teams</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#827C89]">Manage members, invitations, roles, ownership, and team repository settings.</p></div>
        <button className={buttonClass} onClick={() => loadTeams()} disabled={loading || busy}><RefreshCw size={15} />Refresh</button>
      </div>

      {(error || notice) && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E9C9C9] bg-[#FFF3F1] text-[#9C5050]" : "border-[#D9E7D9] bg-[#F2F8F1] text-[#527451]"}`} role={error ? "alert" : "status"}>{error || notice}</div>}

      <div className="grid gap-6 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-[#E8D9DE] bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="font-semibold">Your teams</h2><span className="text-xs text-[#827C89]">{teams.length}</span></div>
          {loading && teams.length === 0 ? <p className="px-2 py-6 text-sm text-[#827C89]">Loading teams…</p> : teams.length === 0 ? <p className="px-2 py-5 text-sm leading-6 text-[#827C89]">You are not a member of any team yet.</p> : <div className="space-y-1">{teams.map((team) => <button key={team.id} onClick={() => selectTeam(team)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedTeam?.id === team.id ? "bg-[#F1EDF4]" : "hover:bg-[#FAF7F8]"}`}><span className="block truncate text-sm font-semibold">{team.name}</span><span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#827C89]"><span>{team.role}</span><span>{team.memberCount ?? ""}</span></span></button>)}</div>}
          <form onSubmit={handleCreateTeam} className="mt-4 border-t border-[#F0E8EA] pt-4"><label htmlFor="new-team-name" className="mb-2 block text-xs font-semibold text-[#706B79]">Create a team</label><input id="new-team-name" className={inputClass} value={teamName} onChange={(event) => setTeamName(event.target.value)} maxLength={120} placeholder="Team name" /><button type="submit" className={`${buttonClass} mt-2 w-full`} disabled={busy || !teamName.trim()}><Plus size={15} />Create team</button></form>
        </aside>

        <section className="min-w-0 space-y-6">
          {invitations.length > 0 && <div className="rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-sm"><h2 className="font-semibold">Invitations for you</h2><div className="mt-3 divide-y divide-[#F0E8EA]">{invitations.map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{invitation.team.name}</p><p className="mt-1 text-xs text-[#827C89]">Invited as {invitation.role} · {invitation.invitedBy.name || invitation.invitedBy.email}</p></div><div className="flex gap-2"><button className={buttonClass} disabled={busy} onClick={() => runAction(() => respondToTeamInvitation(invitation.id, true), "Invitation accepted.", invitation.teamId)}>Accept</button><button className="rounded-xl border border-[#DCD2DC] px-4 py-2.5 text-sm font-semibold text-[#706B79] hover:bg-[#FAF7F8]" disabled={busy} onClick={() => runAction(() => respondToTeamInvitation(invitation.id, false), "Invitation declined.")}>Decline</button></div></div>)}</div></div>}

          {!selectedTeam ? <div className="rounded-2xl border border-dashed border-[#DCD2DC] bg-white px-6 py-16 text-center"><Users className="mx-auto text-[#8293B2]" size={34} /><h2 className="mt-4 text-lg font-semibold">Start a team workspace</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#827C89]">Create a team to invite collaborators and connect repositories through a GitHub App installation.</p></div> : <>
            <div className="rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#8293B2]">Team workspace</p><h2 className="mt-1 text-2xl font-bold">{selectedTeam.name}</h2><p className="mt-1 text-sm text-[#827C89]">{selectedTeam.slug} · {activeMembers.length} active {activeMembers.length === 1 ? "member" : "members"}</p></div><TeamRole role={selectedTeam.role} /></div>
              <div className="mt-6 flex items-center justify-between gap-3"><h3 className="font-semibold">Members</h3>{canManage && <span className="text-xs text-[#827C89]">Owner and Admin can invite members</span>}</div>
              <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-[#F0E8EA] text-xs text-[#827C89]"><th className="py-2 pr-3 font-medium">Member</th><th className="py-2 pr-3 font-medium">Role</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium">Actions</th></tr></thead><tbody>{members.map((member) => { const isSelf = member.email?.toLowerCase() === user?.email?.toLowerCase(); const canChange = isOwner || (selectedTeam.role === "ADMIN" && ["DEVELOPER", "REVIEWER"].includes(member.role)); const canRemove = canManage && !isSelf && (isOwner || !["OWNER", "ADMIN"].includes(member.role)); return <tr key={member.userId} className="border-b border-[#F5EFF1] last:border-0"><td className="py-3 pr-3"><p className="font-medium">{member.name || member.email}{isSelf ? " (you)" : ""}</p><p className="mt-0.5 text-xs text-[#827C89]">{member.email}</p></td><td className="py-3 pr-3"><TeamRole role={member.role} /></td><td className="py-3 pr-3"><span className="text-xs text-[#706B79]">{member.status}</span></td><td className="py-3"><div className="flex flex-wrap items-center gap-2">{member.status === "ACTIVE" && canChange && <select aria-label={`Change ${member.email} role`} className="rounded-lg border border-[#E8D9DE] bg-white px-2 py-1.5 text-xs" value={member.role} disabled={busy} onChange={(event) => runAction(() => changeTeamMemberRole(selectedTeam.id, member.userId, event.target.value), "Member role updated.")}>{(isOwner ? roles : ["DEVELOPER", "REVIEWER"]).map((role) => <option key={role} value={role}>{role}</option>)}</select>}{canRemove && member.status === "ACTIVE" && <button aria-label={`Remove ${member.email}`} title="Remove member" disabled={busy} onClick={() => runAction(() => removeTeamMember(selectedTeam.id, member.userId), "Member removed.")} className="rounded-lg p-2 text-[#9C5050] hover:bg-[#FFF3F1]"><UserMinus size={15} /></button>}</div></td></tr>; })}</tbody></table></div>
              {canManage && <form onSubmit={(event) => { event.preventDefault(); if (inviteEmail.trim()) runAction(() => inviteTeamMember(selectedTeam.id, inviteEmail.trim(), inviteRole), "Invitation sent.").then(() => setInviteEmail("")); }} className="mt-5 rounded-xl bg-[#FAF7F8] p-4"><div className="mb-3 flex items-center gap-2 text-sm font-semibold"><UserPlus size={16} />Invite an HAKI account</div><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_170px_auto]"><input type="email" required className={inputClass} value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="member@example.com" /><select className={inputClass} value={inviteRole} onChange={(event) => setInviteRole(event.target.value)}><option value="DEVELOPER">Developer</option><option value="REVIEWER">Reviewer</option>{isOwner && <option value="ADMIN">Admin</option>}</select><button className={buttonClass} disabled={busy || !inviteEmail.trim()} type="submit">Invite</button></div><p className="mt-2 text-xs text-[#827C89]">The invited person must already have an HAKI account with this email.</p></form>}
              <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[#F0E8EA] pt-4">{isOwner && activeMembers.some((member) => member.email?.toLowerCase() !== user?.email?.toLowerCase()) && <div className="flex flex-wrap gap-2"><select className="rounded-xl border border-[#E8D9DE] bg-white px-3 py-2 text-sm" value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}><option value="">Transfer ownership to…</option>{activeMembers.filter((member) => member.email?.toLowerCase() !== user?.email?.toLowerCase()).map((member) => <option key={member.userId} value={member.userId}>{member.name || member.email}</option>)}</select><button className="rounded-xl border border-[#DCD2DC] px-3 py-2 text-sm font-semibold hover:bg-[#FAF7F8]" disabled={busy || !transferTarget} onClick={() => runAction(() => transferTeamOwnership(selectedTeam.id, transferTarget), "Ownership transferred.")}>Transfer ownership</button></div>}{currentMember && <button className="rounded-xl border border-[#DCD2DC] px-3 py-2 text-sm font-semibold text-[#9C5050] hover:bg-[#FFF3F1]" disabled={busy} onClick={() => runAction(() => leaveTeam(selectedTeam.id), "You left the team.", undefined)}>Leave team</button>}</div>
            </div>

            <div className="rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">GitHub repositories</h3><p className="mt-1 text-xs text-[#827C89]">Connect repositories through the HAKI GitHub App. Repository access follows installation permissions.</p></div>{canManage && <button className={buttonClass} disabled={busy} onClick={installGitHubApp}>Connect GitHub App</button>}</div>{githubRepositories.length ? <ul className="mt-4 divide-y divide-[#F0E8EA]">{githubRepositories.map((repository) => <li key={repository.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{repository.fullName}</p><p className="mt-1 text-xs text-[#827C89]">{repository.isPrivate ? "Private" : "Public"} · {repository.defaultBranch}{repository.isArchived ? " · Archived" : ""}</p></div><a className="inline-flex items-center gap-1 text-sm text-[#586E94] hover:underline" href={repository.htmlUrl} target="_blank" rel="noreferrer">Open on GitHub <ExternalLink size={13} /></a></li>)}</ul> : <p className="mt-4 rounded-xl bg-[#FAF7F8] p-4 text-sm text-[#827C89]">No GitHub repositories are connected to this team yet.</p>}</div><div className="rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Team settings</h3><p className="mt-1 text-xs text-[#827C89]">Repository review defaults for this team.</p></div><ShieldCheck size={18} className="text-[#8293B2]" /></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Default branch<input className={`${inputClass} mt-1.5`} value={settings.defaultBranch} disabled={!canManage} onChange={(event) => setSettings((current) => ({ ...current, defaultBranch: event.target.value }))} /></label><label className="text-sm font-medium">Required approvals<input className={`${inputClass} mt-1.5`} type="number" min="0" max="10" value={settings.requiredApprovals} disabled={!canManage} onChange={(event) => setSettings((current) => ({ ...current, requiredApprovals: Number(event.target.value) }))} /></label><label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={settings.requireReviews} disabled={!canManage} onChange={(event) => setSettings((current) => ({ ...current, requireReviews: event.target.checked }))} />Require reviews on submissions</label></div>{canManage && <button className={`${buttonClass} mt-4`} disabled={busy} onClick={() => runAction(() => updateTeamSettings(selectedTeam.id, settings), "Team settings saved.")}>Save settings</button>}</div>
          </>}
        </section>
      </div>
    </div>
  </main>;
}
