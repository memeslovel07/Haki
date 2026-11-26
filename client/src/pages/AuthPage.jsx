import { useEffect, useState } from "react";
import { loginAccount, registerAccount } from "../services/api";
import HakiLogo from "../components/HakiLogo";

function AuthPage({ onAuth, embedded = false, inline = false, onClose, oauthError = "", theme }) {
  const [flow, setFlow] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!embedded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [embedded]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const result = flow === "register"
        ? await registerAccount({ fullName, email, password })
        : await loginAccount({ email, password });

      localStorage.setItem("haki_token", result.token);
      onAuth(result.user);
    } catch (submitError) {
      setError(submitError.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function changeFlow(nextFlow) {
    setFlow(nextFlow);
    setError("");
    setNotice("");
  }

  return (
    <main
      data-theme={theme || document.documentElement.dataset.theme || "light"}
      className={`auth-page ${embedded ? "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#0B1020]/80 p-3 sm:p-6" : inline ? "inline-auth-page flex w-full items-center justify-center px-4 py-10 sm:px-8" : "flex min-h-screen items-center justify-center bg-[#FAF8F1] px-4 py-10"} text-[#4F574F]`}
      onClick={embedded ? onClose : undefined}
    >
      <div
        role={embedded ? "dialog" : undefined}
        aria-modal={embedded ? "true" : undefined}
        aria-label={embedded || inline ? "Sign in to HAKI" : undefined}
        onClick={embedded ? (event) => event.stopPropagation() : undefined}
        className={`relative grid w-full ${embedded || inline ? "max-w-xl grid-cols-1" : "max-w-5xl lg:grid-cols-[0.9fr_1.1fr]"} ${embedded ? "max-h-[calc(100dvh-2rem)] overflow-y-auto" : ""} overflow-hidden rounded-3xl border border-[#E5E7EC] bg-[#FEFCF7] shadow-2xl`}
      >
        {(embedded || inline) && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close login"
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl text-[#5B6058] shadow hover:bg-white"
          >
            ×
          </button>
        )}

        {!embedded && !inline && <section className="auth-showcase hidden flex-col justify-between bg-gradient-to-br from-[#F6D9D4] via-[#FFF0D5] to-[#CDE9DF] p-12 lg:flex">
          <div>
            <div className="flex items-center gap-3"><HakiLogo className="h-11 w-11"/><p className="text-2xl font-black tracking-wide">HAKI<span className="text-[#438C89]">.</span></p></div>
            <p className="mt-1 text-sm text-[#666B63]">Version Control Workspace</p>
          </div>
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#397C79]">Build · Commit · Track</p>
            <h1 className="text-5xl font-bold leading-tight">Your code,<br />organized.</h1>
            <p className="mt-5 max-w-sm leading-7 text-[#666B63]">Keep your projects, files, and commit history together.</p>
          </div>
          <p className="text-xs text-[#777B72]">HAKI account access</p>
        </section>}

        <section className={`${embedded || inline ? "p-5 pt-14 sm:p-6 sm:pt-12" : "p-5 pt-14 sm:p-8 sm:pt-14 lg:p-12"}`}>
          <div className={`${embedded || inline ? "mb-5" : "mb-8 lg:hidden"}`}>
            <div className="flex items-center gap-3"><HakiLogo className="h-10 w-10"/><p className="text-2xl font-black">HAKI<span className="text-[#438C89]">.</span></p></div>
            <p className="text-sm text-[#777B72]">Version Control Workspace</p>
          </div>

          <p className="text-sm font-semibold uppercase tracking-widest text-[#727F8F]">Welcome to HAKI</p>
          <h2 className="mt-3 text-3xl font-bold">
            {flow === "login" ? "Sign in to your account" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm text-[#666B63]">
            {flow === "login"
              ? "Sign in to continue to your workspace."
              : "Create an account to get started with HAKI."}
          </p>

          {flow === "login" && oauthError && (
            <p role="alert" className="mt-4 rounded-lg border border-[#E2D8C8] bg-[#F1E8DD] px-3 py-2.5 text-sm text-[#8C7967]">
              {oauthError}
            </p>
          )}

          <div className={`${embedded || inline ? "mt-5" : "mt-7"} grid grid-cols-2 rounded-xl bg-white p-1`}>
            <button
              type="button"
              onClick={() => changeFlow("login")}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${flow === "login" ? "bg-[#E2E5DA] text-[#4F574F]" : "text-[#666B63] hover:text-[#4F574F]"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => changeFlow("register")}
              className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${flow === "register" ? "bg-[#E2E5DA] text-[#4F574F]" : "text-[#666B63] hover:text-[#4F574F]"}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={submit} className={`${embedded || inline ? "mt-5 space-y-3" : "mt-7 space-y-5"}`}>
            {flow === "register" && (
              <div>
                <label htmlFor="full-name" className="mb-2 block text-sm font-medium text-[#5B6058]">Full name</label>
                <input
                  id="full-name"
                  autoComplete="name"
                  required
                  minLength={2}
                  maxLength={120}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your name"
                  className="w-full rounded-xl border border-[#E1E3E8] bg-white px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#D4D7DD]"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-[#5B6058]">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#E1E3E8] bg-white px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#D4D7DD]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-[#5B6058]">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={flow === "login" ? "current-password" : "new-password"}
                required
                minLength={flow === "register" ? 12 : undefined}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={flow === "register" ? "At least 12 characters" : "Enter your password"}
                className="w-full rounded-xl border border-[#E1E3E8] bg-white px-4 py-3 text-[#4F574F] outline-none placeholder:text-[#92948A] focus:border-[#D4D7DD]"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-[#E2D8C8] bg-[#F1E8DD] px-3 py-2.5 text-sm text-[#8C7967]">
                {error}
              </p>
            )}

            {notice && (
              <p role="status" className="rounded-lg border border-[#E4E7EC] bg-[#EEF0F4] px-3 py-2.5 text-sm text-[#687B65]">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-[#D4D7DD] px-4 py-3.5 font-semibold text-[#4F574F] transition hover:bg-[#E8EBF0] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Please wait…" : flow === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          {flow === "login" && (
            <>
              <div className={`${embedded || inline ? "my-3" : "my-5"} flex items-center gap-3 text-xs text-[#777B72]`}>
                <span className="h-px flex-1 bg-[#E5E7EC]" />
                <span>OR</span>
                <span className="h-px flex-1 bg-[#E5E7EC]" />
              </div>

              <a
                href="http://localhost:5001/api/v1/auth/github"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E1E3E8] bg-white px-4 py-3.5 font-semibold text-[#4F574F] transition hover:bg-[#F7F5EE]"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.3 9.4 7.88 10.93.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.43-2.7 5.41-5.28 5.7.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
                </svg>
                Continue with GitHub
              </a>
            </>
          )}

          {!inline && <p className={`${embedded ? "mt-4" : "mt-6"} text-center text-xs leading-5 text-[#777B72]`}>
            Authentication is handled by the HAKI server. Repository workspace data is currently stored in this browser.
          </p>}
        </section>
      </div>
    </main>
  );
}

export default AuthPage;
