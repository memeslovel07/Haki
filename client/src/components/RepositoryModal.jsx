function RepositoryModal({ isOpen, onClose, onSubmit, form, setForm, editing }) {
  if (!isOpen) return null;

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#E0E4EA]/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-[#E5E7EC] bg-[#FFFFFF] p-6 shadow-2xl shadow-black/50 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#7F8C77]">HAKI Workspace</div>
            <h2 className="text-2xl font-bold text-[#4F574F]">
              {editing ? "Edit Repository" : "Create Repository"}
            </h2>
            <p className="mt-1 text-sm text-[#777B72]">
              {editing ? "Update your repository details." : "Create a new repository for your project."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EC] text-xl text-[#777B72] hover:bg-[#F0F1F4] hover:text-[#4F574F]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#5B6058]">Repository Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="my-project"
              autoFocus
              className="w-full rounded-xl border border-[#E5E7EC] bg-[#FAF8F1] px-4 py-3.5 text-[#4F574F] outline-none transition placeholder:text-[#92948A] focus:border-[#B7C0CB] focus:ring-2 focus:ring-[#DCE2D6]/30"
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-semibold text-[#5B6058]">Repository visibility</legend>
            <div className="grid grid-cols-2 gap-3">
              {[{ value: "private", label: "Private", icon: "🔒" }, { value: "public", label: "Public", icon: "🌐" }].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm({ ...form, visibility: option.value })}
                  aria-pressed={(form.visibility || "private") === option.value}
                  className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${(form.visibility || "private") === option.value ? "border-[#B7C0CB] bg-[#DCE2D6]/30 text-[#4F574F]" : "border-[#E5E7EC] bg-white text-[#666B63] hover:bg-[#FAF8F1]"}`}
                >
                  <span className="mr-2">{option.icon}</span>{option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#777B72]">{form.visibility === "public" ? "Anyone signed into HAKI can view it. Only you or an admin can make changes." : "Only you and an admin can view or change it."}</p>
          </fieldset>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#5B6058]">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe your repository..."
              rows="5"
              className="w-full resize-none rounded-xl border border-[#E5E7EC] bg-[#FAF8F1] px-4 py-3.5 text-[#4F574F] outline-none transition placeholder:text-[#92948A] focus:border-[#B7C0CB] focus:ring-2 focus:ring-[#DCE2D6]/30"
            />
          </div>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E1E3E8] px-5 py-3 text-sm font-semibold text-[#5B6058] hover:bg-[#F0F1F4] hover:text-[#4F574F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-[#E0E4EA] px-5 py-3 text-sm font-semibold text-[#4F574F] shadow-lg shadow-[#DCE2D6]/30 hover:bg-[#B7C0CB]"
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
