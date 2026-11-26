import HakiLogo from "./HakiLogo";

function Navbar() {
  return (
    <header className="border-b border-[#E5E7EC] bg-[#FAF8F1]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <div>
          <div className="flex items-center gap-2"><HakiLogo className="h-10 w-10"/><h1 className="text-xl font-bold tracking-tight text-[#4F574F]">HAKI</h1></div>

          <p className="text-xs text-[#777B72]">
            Version Control System
          </p>
        </div>

        <div className="text-sm text-[#666B63]">
          College Minor Project
        </div>
      </div>
    </header>
  );
}

export default Navbar;
