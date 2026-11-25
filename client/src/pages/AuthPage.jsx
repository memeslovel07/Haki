import { useState } from "react";
import { loginAccount, registerAccount, requestPasswordReset, resetPassword, verifyRegistration } from "../services/api";

function AuthPage({ onAuth, embedded = false, onClose, oauthError = "" }) {
  const [flow, setFlow] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isCodeStep = flow === "verify-registration" || flow === "reset-password";
  const isRegister = flow === "register" || flow === "verify-registration";

  function showDevelopmentCode(result) {
    if (result.developmentCode) {
      setNotice(`Local test code: ${result.developmentCode}. Email delivery is not configured.`);
    } else {
      setNotice(result.message || "Check your inbox for the code.");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (flow === "login") {
        const result = await loginAccount({ email, password });
        localStorage.setItem("haki_token", result.token);
        onAuth(result.user);
      } else if (flow === "register") {
        const result = await registerAccount({ fullName, email, password });
        showDevelopmentCode(result);
        setFlow("verify-registration");
      } else if (flow === "verify-registration") {
        const result = await verifyRegistration({ email, code });
        localStorage.setItem("haki_token", result.token);
        onAuth(result.user);
      } else if (flow === "forgot-password") {
        const result = await requestPasswordReset(email);
        showDevelopmentCode(result);
        setFlow("reset-password");
      } else {
        const result = await resetPassword({ email, code, password });
        setFlow("login");
        setPassword("");
        setCode("");
        setNotice(result.message || "Password updated. Sign in with your new password.");
      }
    } catch (submitError) {
      setError(submitError.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const result = flow === "verify-registration"
        ? await registerAccount({ fullName, email, password })
        : await requestPasswordReset(email);
      showDevelopmentCode(result);
    } catch (sendError) {
      setError(sendError.message || "Could not send another code.");
    } finally {
      setBusy(false);
    }
  }

  function changeFlow(nextFlow) {
    setFlow(nextFlow);
    setCode("");
    setError("");
    setNotice("");
  }

  const heading = {
    login: "Sign in to your account",
    register: "Create your account",
    "verify-registration": "Check your email",
    "forgot-password": "Reset your password",
    "reset-password": "Choose a new password",
  }[flow];

  return (
    <main className={`${embedded ? "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#302D3B]/55 p-3 sm:p-6" : "flex min-h-screen items-center justify-center bg-[#FFF8F1] px-4 py-10"} text-[#302D3B]`} onClick={embedded ? onClose : undefined}>
      <div role={embedded ? "dialog" : undefined} aria-modal={embedded ? "true" : undefined} aria-label={embedded ? "Sign in to HAKI" : undefined} onClick={embedded ? (event) => event.stopPropagation() : undefined} className={`relative grid w-full ${embedded ? "max-h-[94vh] max-w-4xl overflow-y-auto" : "max-w-5xl"} overflow-hidden rounded-3xl border border-[#E8D9DE] bg-[#FFFCFA] shadow-2xl lg:grid-cols-[0.9fr_1.1fr]`}>
        {embedded && <button type="button" onClick={onClose} aria-label="Close login" className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-xl text-[#514D5A] shadow hover:bg-white">×</button>}
        <section className="hidden flex-col justify-between bg-gradient-to-br from-[#FBE2DE] via-[#EAD9DF] to-[#C3C6DF] p-12 lg:flex">
          <div><p className="text-2xl font-black tracking-wide">HAKI<span className="text-[#7187AC]">.</span></p><p className="mt-1 text-sm text-[#706B79]">Version Control Workspace</p></div>
          <div><p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-[#8293B2]">Build · Commit · Track</p><h1 className="text-5xl font-bold leading-tight">Your code,<br />organized.</h1><p className="mt-5 max-w-sm leading-7 text-[#706B79]">Keep your projects, files, and commit history together.</p></div>
          <p className="text-xs text-[#827C89]">HAKI account access</p>
        </section>

        <section className="p-5 pt-14 sm:p-8 sm:pt-14 lg:p-12">
          <div className="mb-8 lg:hidden"><p className="text-2xl font-black">HAKI<span className="text-[#7187AC]">.</span></p><p className="text-sm text-[#827C89]">Version Control Workspace</p></div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#8293B2]">Welcome to HAKI</p>
          <h2 className="mt-3 text-3xl font-bold">{heading}</h2>
          <p className="mt-2 text-sm text-[#706B79]">
            {flow === "login" && "Sign in to continue to your workspace."}
            {flow === "register" && "The first account becomes admin; later accounts are members."}
            {flow === "verify-registration" && `Enter the six-digit code for ${email}.`}
            {flow === "forgot-password" && "We’ll send a code to the email on your account."}
            {flow === "reset-password" && `Enter the code sent to ${email}, then choose a new password.`}
          </p>

          {flow === "login" && oauthError && <p role="alert" className="mt-4 rounded-lg border border-[#E5BEBB] bg-[#FBE3DF] px-3 py-2.5 text-sm text-[#A96060]">{oauthError}</p>}

          {(flow === "login" || flow === "register") ? (
            <div className="mt-7 grid grid-cols-2 rounded-xl bg-white p-1">
              <button type="button" onClick={() => changeFlow("login")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${flow === "login" ? "bg-[#DADBEA] text-[#302D3B]" : "text-[#706B79] hover:text-[#302D3B]"}`}>Login</button>
              <button type="button" onClick={() => changeFlow("register")} className={`rounded-lg px-3 py-2.5 text-sm font-semibold ${flow === "register" ? "bg-[#DADBEA] text-[#302D3B]" : "text-[#706B79] hover:text-[#302D3B]"}`}>Create account</button>
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-7 space-y-5">
            {flow === "register" && <div><label htmlFor="full-name" className="mb-2 block text-sm font-medium text-[#514D5A]">Full name</label><input id="full-name" autoComplete="name" required minLength={2} maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your name" className="w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#A9B9D3]" /></div>}
            {(flow === "login" || flow === "register" || flow === "forgot-password") && <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-[#514D5A]">Email address</label><input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#A9B9D3]" /></div>}
            {(flow === "login" || flow === "register") && <div><label htmlFor="password" className="mb-2 block text-sm font-medium text-[#514D5A]">Password</label><input id="password" type="password" autoComplete={flow === "login" ? "current-password" : "new-password"} required minLength={flow === "register" ? 8 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={flow === "register" ? "At least 8 characters" : "Enter your password"} className="w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#A9B9D3]" /></div>}
            {isCodeStep && <div><label htmlFor="verification-code" className="mb-2 block text-sm font-medium text-[#514D5A]">Six-digit code</label><input id="verification-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-lg tracking-[0.35em] text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#A9B9D3]" /></div>}
            {flow === "reset-password" && <div><label htmlFor="new-password" className="mb-2 block text-sm font-medium text-[#514D5A]">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-[#DCD2DC] bg-white px-4 py-3 text-[#302D3B] outline-none placeholder:text-[#958F9B] focus:border-[#A9B9D3]" /></div>}
            {error && <p role="alert" className="rounded-lg border border-[#E5BEBB] bg-[#FBE3DF] px-3 py-2.5 text-sm text-[#A96060]">{error}</p>}
            {notice && <p role="status" className="rounded-lg border border-[#D8E4DC] bg-[#EEF5EF] px-3 py-2.5 text-sm text-[#526E5C]">{notice}</p>}
            <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#A9B9D3] px-4 py-3.5 font-semibold text-[#302D3B] transition hover:bg-[#BFC3DF] disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : flow === "login" ? "Sign in" : flow === "register" ? "Send verification code" : flow === "verify-registration" ? "Verify email" : flow === "forgot-password" ? "Send reset code" : "Update password"}</button>
          </form>

          {flow === "login" && <>
            <div className="my-5 flex items-center gap-3 text-xs text-[#827C89]"><span className="h-px flex-1 bg-[#E8D9DE]" /><span>OR</span><span className="h-px flex-1 bg-[#E8D9DE]" /></div>
            <a href="/api/auth/github" className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DCD2DC] bg-white px-4 py-3.5 font-semibold text-[#302D3B] transition hover:bg-[#F7F4F6]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.3 9.4 7.88 10.93.58.11.79-.25.79-.56v-2.16c-3.2.7-3.88-1.36-3.88-1.36-.53-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.19 1.82 1.19 3.08 0 4.43-2.7 5.41-5.28 5.7.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" /></svg>
              Continue with GitHub
            </a>
          </>}

          {flow === "login" && <button type="button" onClick={() => changeFlow("forgot-password")} className="mt-4 w-full text-center text-sm font-medium text-[#7581AA] hover:text-[#514D5A]">Forgot password?</button>}
          {isCodeStep && <div className="mt-4 flex items-center justify-between text-sm"><button type="button" onClick={resendCode} disabled={busy} className="font-medium text-[#7581AA] hover:text-[#514D5A] disabled:opacity-50">Resend code</button><button type="button" onClick={() => changeFlow(isRegister ? "register" : "forgot-password")} className="text-[#827C89] hover:text-[#514D5A]">Back</button></div>}
          {flow === "forgot-password" && <button type="button" onClick={() => changeFlow("login")} className="mt-4 w-full text-center text-sm text-[#827C89] hover:text-[#514D5A]">Back to sign in</button>}
          <p className="mt-6 text-center text-xs leading-5 text-[#827C89]">Frontend preview only: accounts stay in this browser, and OTP codes appear on screen instead of being emailed.</p>
        </section>
      </div>
    </main>
  );
}

export default AuthPage;
