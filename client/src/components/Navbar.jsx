function Navbar() {
  return (
    <header className="border-b border-[#E8D9DE] bg-[#FFF8F1]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#302D3B]">
            HAKI
          </h1>

          <p className="text-xs text-[#827C89]">
            Version Control System
          </p>
        </div>

        <div className="text-sm text-[#706B79]">
          College Minor Project
        </div>
      </div>
    </header>
  );
}

export default Navbar;