function RepositoryModal({ isOpen, onClose, onSubmit, form, setForm, editing }) {
  if (!isOpen) return null;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#E8D9DE] bg-[#FFFFFF] p-6 shadow-2xl shadow-black/50 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7581AA]">HAKI Workspace</div>
            <h2 className="text-2xl font-bold text-[#302D3B]">
              {editing ? "Edit Repository" : "Create Repository"}
            </h2>
            <p className="mt-1 text-sm text-[#827C89]">
              {editing ? "Update your repository details." : "Create a new repository for your project."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8D9DE] text-xl text-[#827C89] hover:bg-[#F0E8EC] hover:text-[#302D3B]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#514D5A]">Repository Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="my-project"
              autoFocus
              className="w-full rounded-xl border border-[#E8D9DE] bg-[#FFF8F1] px-4 py-3.5 text-[#302D3B] outline-none transition placeholder:text-[#A49DA8] focus:border-[#AEB6D8] focus:ring-2 focus:ring-[#C3C6DF]/30"
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-[#514D5A]">Repository visibility</legend>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "private", label: "Private", icon: "🔒" }, { value: "public", label: "Public", icon: "🌐" }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm({ ...form, visibility: option.value })}
                  aria-pressed={(form.visibility || "private") === option.value}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${(form.visibility || "private") === option.value ? "border-[#AEB6D8] bg-[#C3C6DF]/30 text-[#302D3B]" : "border-[#E8D9DE] bg-white text-[#706B79] hover:bg-[#FFF8F1]"}`}
                >
                  <span className="mr-2">{option.icon}</span>{option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#827C89]">{form.visibility === "public" ? "Anyone signed into HAKI can view it. Only you or an admin can make changes." : "Only you and an admin can view or change it."}</p>
          </fieldset>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#514D5A]">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe your repository..."
              rows="5"
              className="w-full resize-none rounded-xl border border-[#E8D9DE] bg-[#FFF8F1] px-4 py-3.5 text-[#302D3B] outline-none transition placeholder:text-[#A49DA8] focus:border-[#AEB6D8] focus:ring-2 focus:ring-[#C3C6DF]/30"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#DCD2DC] px-5 py-3 text-sm font-semibold text-[#514D5A] hover:bg-[#F0E8EC] hover:text-[#302D3B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#B9BFDD] px-5 py-3 text-sm font-semibold text-[#302D3B] shadow-lg shadow-[#C3C6DF]/30 hover:bg-[#AEB6D8]"
            >
              {editing ? "Save Changes" : "Create Repository"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RepositoryModal;
