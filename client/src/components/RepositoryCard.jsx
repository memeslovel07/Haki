function RepositoryCard({ repository, onOpen, onEdit, onDelete, canManage = true }) {
  const updatedDate = repository.updatedAt
    ? new Date(repository.updatedAt).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Recently";

  return (
    <article className="group overflow-hidden rounded-2xl border border-[#E8D9DE] bg-white p-5 shadow-xl shadow-black/10 transition duration-300 hover:-translate-y-1 hover:border-[#C9CBE2] hover:bg-[#FFFCFA] sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D9D8E8] bg-[#AEB6D8]/10 text-xl">
          📁
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-semibold text-[#302D3B]">{repository.name}</h3>
            <span className="rounded-full border border-[#DCD2DC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#706B79]">
              main
            </span>
            <span className="rounded-full border border-[#DCD2DC] bg-[#FFF8F1] px-2.5 py-1 text-[11px] font-semibold text-[#706B79]">
              {repository.visibility === "public" ? "🌐 Public" : "🔒 Private"}
            </span>
          </div>
          <p className="mt-2 min-h-12 text-sm leading-6 text-[#827C89]">
            {repository.description || "No description provided for this repository."}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[#E8D9DE] pt-4">
        <span className="text-xs text-[#958F9B]">Updated {updatedDate}</span>
        <div className="flex items-center gap-2">
          {canManage && <button
            onClick={() => onEdit(repository)}
            className="rounded-lg border border-[#DCD2DC] px-3 py-2 text-xs font-semibold text-[#514D5A] transition hover:border-[#DCD2DC] hover:bg-[#F0E8EC] hover:text-[#302D3B]"
          >
            Edit
          </button>}
          {canManage && <button
            onClick={() => onDelete(repository)}
            className="rounded-lg border border-[#E5BEBB] px-3 py-2 text-xs font-semibold text-[#9B5555] transition hover:bg-[#FBE3DF] hover:text-[#A96060]"
          >
            Delete
          </button>}
          <button
            onClick={() => onOpen(repository)}
            className="rounded-lg bg-[#B9BFDD] px-3.5 py-2 text-xs font-semibold text-[#302D3B] transition hover:bg-[#AEB6D8]"
          >
            Open Repository →
          </button>
        </div>
      </div>
    </article>
  );
}

export default RepositoryCard;
