import { FolderGit2 } from "lucide-react";

function RepositoryCard({ repository, onOpen, onEdit, onDelete, canManage = true }) {
  const updatedDate = repository.updatedAt
    ? new Date(repository.updatedAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <article className="surface-card group overflow-hidden rounded-xl border border-white/[0.075] bg-[#151D2D] p-4 transition duration-300 hover:-translate-y-0.5 hover:border-[#8A95A3]/40 hover:bg-[#182134] sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#687386]/20 bg-[#687386]/10 text-[#B0BAC7]">
          <FolderGit2 size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[#E9ECF5]">{repository.name}</h3>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-[#8994AA]">main</span>
            <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-[#8994AA]">
              {repository.visibility === "public" ? "Public" : "Private"}
            </span>
          </div>
          <p className="mt-2 min-h-10 line-clamp-2 text-xs leading-5 text-[#8994AA]">
            {repository.description || "No description provided for this repository."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3">
        <span className="text-[10px] text-[#748098]">Updated {updatedDate}</span>
        <div className="flex items-center gap-1.5">
          {canManage && <button onClick={() => onEdit(repository)} className="rounded-md border border-white/[0.09] px-2.5 py-1.5 text-[10px] font-medium text-[#AAB4C5] transition hover:bg-white/[0.06] hover:text-white">Edit</button>}
          {canManage && <button onClick={() => onDelete(repository)} className="rounded-md border border-white/[0.09] px-2.5 py-1.5 text-[10px] font-medium text-[#C6A792] transition hover:bg-[#987A68]/15">Delete</button>}
          <button onClick={() => onOpen(repository)} className="rounded-md bg-[#687386]/15 px-2.5 py-1.5 text-[10px] font-semibold text-[#D0D5DE] transition hover:bg-[#687386]/25">Open →</button>
        </div>
      </div>
    </article>
  );
}

export default RepositoryCard;
