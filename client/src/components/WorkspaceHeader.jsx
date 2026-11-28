import { Link, NavLink } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import UserAvatar from "./UserAvatar";
import HakiLogo from "./HakiLogo";
const links = [["/", "Repositories"], ["/governance", "Governance"], ["/teams", "Teams"], ["/setting", "Settings"], ["/import", "Import"], ["/about", "About"]];
export default function WorkspaceHeader({ user, onUserUpdate, onSignOut, title, theme, onThemeToggle }) {
  return <header className="sticky top-0 z-30 border-b border-[#E5E7EC] bg-[#FAF8F1]/95 px-4 py-3 backdrop-blur sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
    <div className="flex items-center gap-3"><Link to="/" className="flex items-center gap-2 text-2xl font-black tracking-tight"><HakiLogo className="h-10 w-10"/>HAKI<span className="text-[#697586]">.</span></Link><span className="hidden text-[#D9DCE2] sm:inline">/</span><span className="hidden text-sm text-[#666B63] sm:inline">{title}</span></div>
    <nav aria-label="Workspace" className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto">{links.map(([to, label]) => <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-[#E9E6D9] text-[#4F574F]" : "text-[#666B63] hover:bg-white hover:text-[#4F574F]"}`}>{label}</NavLink>)}</nav>
    <div className="order-2 flex items-center gap-2 sm:order-3"><UserAvatar user={user} onUserUpdate={onUserUpdate} size="h-9 w-9" /><span className="hidden max-w-32 truncate text-sm font-medium text-[#666B63] lg:block">{user?.fullName || user?.email}</span><button type="button" onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="theme-toggle rounded-lg border border-[#E1E3E8] p-2 text-[#5B6058] hover:bg-white">{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button><button type="button" onClick={onSignOut} className="rounded-lg border border-[#E1E3E8] px-3 py-2 text-xs font-semibold text-[#5B6058] hover:bg-white">Sign out</button></div>
  </div></header>;
}
