import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/api";

export default function PasswordResetPage() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (password !== confirm) return setError("Passwords do not match.");
    setSaving(true);
    try {
      await resetPassword(token, password);
      navigate("/", { replace: true, state: { openLogin: true } });
    } catch (resetError) {
      setError(resetError.message || "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#FFF8F1] px-4 py-10 text-[#302D3B]">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-[#E8D9DE] bg-white p-7 shadow-xl">
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      {!token && <p role="alert" className="text-sm text-[#A96060]">This reset link is missing. Request a new one from the sign-in screen.</p>}
      <label className="block text-sm font-medium">New password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCD2DC] px-4 py-3" /></label>
      <label className="block text-sm font-medium">Confirm password<input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full rounded-xl border border-[#DCD2DC] px-4 py-3" /></label>
      {error && <p role="alert" className="text-sm text-[#A96060]">{error}</p>}
      <button disabled={!token || saving} className="w-full rounded-xl bg-[#A9B9D3] px-4 py-3 font-semibold disabled:opacity-50">{saving ? "Updating…" : "Update password"}</button>
      <Link to="/" className="block text-center text-sm text-[#7187AC]">Back to HAKI</Link>
    </form>
  </main>;
}
