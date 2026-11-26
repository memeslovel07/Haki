import { useRef, useState } from "react";
import { updateProfileAvatar } from "../services/api";

function UserAvatar({ user, onUserUpdate, size = "h-10 w-10" }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fallback = user?.role === "admin" ? "admin" : (user?.avatarId || "member-1");
  const image = user?.avatarDataUrl || `/avatars/${fallback}.svg`;

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPG, or WebP image.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setError("Image must be 1 MB or smaller.");
      return;
    }

    setError("");
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setError("Could not read that image. Try another file.");
      setBusy(false);
    };
    reader.onload = async () => {
      try {
        const result = await updateProfileAvatar(reader.result);
        onUserUpdate?.(result.user);
      } catch (uploadError) {
        setError(uploadError.message || "Could not save your profile image.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Change profile picture"
        aria-label="Change profile picture"
        className={`group relative shrink-0 overflow-hidden rounded-full border-2 border-white shadow-sm ring-1 ring-[#E8D9DE] transition hover:ring-[#A9B9D3] disabled:opacity-60 ${size}`}
      >
        <img src={image} alt={`${user?.fullName || "Profile"} avatar`} className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-[#302D3B]/0 text-white opacity-0 transition group-hover:bg-[#302D3B]/45 group-hover:opacity-100" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
            <circle cx="12" cy="13.5" r="3.2" />
          </svg>
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
      {busy && <span className="absolute -bottom-4 whitespace-nowrap text-[10px] text-[#706B79]">Saving…</span>}
      {error && <span role="alert" className="absolute top-full z-20 mt-1 w-44 rounded-lg border border-[#E5BEBB] bg-[#FBE3DF] p-2 text-center text-[10px] leading-4 text-[#8F4C4C]">{error}</span>}
    </div>
  );
}

export default UserAvatar;
