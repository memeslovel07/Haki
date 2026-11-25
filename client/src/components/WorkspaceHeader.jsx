import { Link, NavLink } from "react-router-dom";
import UserAvatar from "./UserAvatar";
const links = [["/", "Repositories"], ["/setting", "Settings"], ["/import", "Import"], ["/about", "About"]];
export default function WorkspaceHeader({ user, onUserUpdate, onSignOut, title }) {
  return <header className="sticky top-0 z-30 border-b border-[#E8D9DE] bg-[#FFF8F1]/95 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-3"><Link to="/" className="text-2xl font-black tracking-tight">HAKI<span className="text-[#7187AC]">.</span></Link><span className="hidden text-[#D2C7D0] sm:inline">/</span><span className="hidden text-sm text-[#706B79] sm:inline">{title}</span></div>
    <nav aria-label="Workspace" className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-[#EAD9DF] text-[#302D3B]" : "text-[#706B79] hover:bg-white hover:text-[#302D3B]"}`}>{label}</NavLink>)}</nav>
    <div className="order-2 flex items-center gap-2 sm:order-3"><UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-9 w-9" /><span className="hidden max-w-32 truncate text-sm font-medium text-[#706B79] lg:block">{user?.fullName || user?.email}</span><button type="button" onClick={onSignOut} className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-xs font-semibold text-[#514D5A] hover:bg-white">Sign out</button></div>
  </div></header>;
}
