import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Moon, Sun } from 'lucide-react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Chatbot from "./components/Chatbot.jsx"
import HakiLogo from "./components/HakiLogo.jsx";
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ImportRepository from "./pages/ImportRepository";
import GovernancePage from "./pages/GovernancePage";
import TeamsPage from "./pages/TeamsPage";
import RepositoryWorkspace from "./pages/RepositoryWorkspace";
import SettingPage from "./pages/SettingPage";
import PasswordResetPage from "./pages/PasswordResetPage";
import WorkspaceHeader from "./components/WorkspaceHeader";
import { refreshBackendSession, logoutAccount } from "./services/api";

function PublicHome({ onAuth, theme, onThemeToggle, githubSessionError = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginPopup, setShowLoginPopup] = useState(() => Boolean(githubSessionError || location.state?.openLogin || new URLSearchParams(window.location.search).has("auth") || new URLSearchParams(window.location.search).has("auth_error")));
  const [loginPrompt, setLoginPrompt] = useState(() => location.state?.loginRequired ? "Login required to access your workspace." : "");
  useEffect(() => {
    if (!loginPrompt) return undefined;
    const timeout = window.setTimeout(() => setLoginPrompt(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [loginPrompt]);
  const [oauthError, setOauthError] = useState(() => {
    if (githubSessionError) return "GitHub returned to HAKI, but the server session could not be verified. Please try again.";
    const code = new URLSearchParams(window.location.search).get("auth_error");
    const messages = {
      github_not_configured: "GitHub sign-in is not configured yet.",
      github_cancelled: "GitHub sign-in was cancelled. You can try again.",
      github_email_unavailable: "GitHub did not share a verified primary email. Add one in GitHub settings, then try again.",
      account_not_found: "No HAKI account is connected to this GitHub account yet. Choose Create account, then Create account with GitHub.",
      account_link_required: "Sign in to your HAKI account and connect GitHub in Settings before using GitHub sign-in.",
      account_unavailable: "This HAKI account is unavailable. Contact the project administrator.",
      invalid_oauth_state: "The GitHub sign-in expired or could not be verified. Start again.",
      github_oauth_failed: "GitHub sign-in could not be completed. Check the OAuth app configuration and try again.",
    };
    return code ? messages[code] || "GitHub sign-in could not be completed." : "";
  });
  const [nextPath, setNextPath] = useState(() => location.state?.from || "/");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const auth = params.get("auth");
    const errorCode = params.get("auth_error");
    if (auth !== "github" && !errorCode) return;

    window.history.replaceState({}, "", window.location.pathname);

    if (errorCode) return;

    refreshBackendSession()
      .then((result) => {
        onAuth(result.user);
        setShowLoginPopup(false);
        navigate(nextPath || "/", { replace: true });
      })
      .catch(() => {
        setOauthError("GitHub sign-in could not be completed. Please try again.");
        setShowLoginPopup(true);
      });
  }, [onAuth, navigate, nextPath]);
  function askForLogin(path) {
    setNextPath(path);
    setShowLoginPopup(true);
  }

  function continueToLogin() {
    setShowLoginPopup(true);
  }

  function requireLogin() {
    setLoginPrompt("Login required to access your workspace.");
  }

  function finishLogin(authenticatedUser) {
    onAuth(authenticatedUser);
    setShowLoginPopup(false);
    navigate(nextPath || "/", { replace: true });
  }

  return (
    <div className="home-shell page-enter min-h-screen overflow-hidden bg-[#0B1020] text-[#E9ECF5]" data-theme={theme}>
      <header className="relative z-10 border-b border-white/[0.07] bg-[#0B1020]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5"><HakiLogo className="h-10 w-10"/><span className="text-lg font-bold tracking-tight">HAKI<span className="text-[#B7C0CC]">.</span></span></a>
          <nav className="hidden items-center gap-8 text-sm text-[#B8B8B2] md:flex"><a href="#top" className="transition hover:text-white">Home</a><a href="#features" className="transition hover:text-white">Features</a><a href="#workflow" className="transition hover:text-white">How it works</a><a href="/about" className="transition hover:text-white">About</a></nav>
          <div className="flex items-center gap-2"><button onClick={onThemeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} className="theme-toggle rounded-lg border border-white/[0.1] p-2.5 text-[#C5CDE0] transition hover:bg-white/[0.07]">{theme === "dark" ? <Sun size={15}/> : <Moon size={15}/>}</button><button onClick={continueToLogin} className="hidden rounded-lg px-4 py-2.5 text-xs font-semibold text-[#B8C1D1] transition hover:bg-white/[0.05] hover:text-white sm:block">Log in</button><button onClick={() => askForLogin("/create")} className="inline-flex items-center gap-2 rounded-lg bg-[#687386] px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#687386]/20 transition hover:bg-[#7A8698]">Get started<ArrowUpRight size={14}/></button></div>
        </div>
      </header>

      <main id="top" className={showLoginPopup ? "min-h-[calc(100dvh-72px)]" : ""}>
        {showLoginPopup ? <AuthPage embedded onClose={() => setShowLoginPopup(false)} onAuth={finishLogin} oauthError={oauthError}/> : <>
        <section className="welcome-hero mx-auto flex min-h-[68vh] max-w-6xl flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-[#65B9B5]">Your developer workspace</p>
          <h1 className="max-w-4xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">Welcome to HAKI<span className="text-[#65B9B5]">.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#A7A7A1] sm:text-xl">Keep your repositories and project activity together in one calm, focused workspace.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-4"><button onClick={() => askForLogin("/create")} className="inline-flex items-center gap-2 rounded-xl bg-[#438C89] px-6 py-3.5 text-base font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#367C79]">Get started<ArrowRight size={18}/></button><a href="#about" className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-6 py-3.5 text-base font-medium text-[#E5E5E0] transition hover:bg-white/[0.06]">Learn more<ArrowUpRight size={17}/></a></div>
        </section>
        <section id="features" className="border-y border-white/[0.08] bg-[#151515] px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#65B9B5]">A clearer workflow</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Everything your code needs, in one place.</h2><p className="mt-4 max-w-2xl text-lg leading-8 text-[#A7A7A1]">Organize repositories, follow changes, and see your team’s progress without losing focus.</p>
            <div className="mt-10 grid gap-4 md:grid-cols-3">{[["Repositories","Keep projects organized with clear ownership and visibility."],["Monthly activity","See commits and repository updates across the last month."],["One workspace","Bring your development work into a simple, focused view."]].map(([title,description])=><article key={title} className="rounded-2xl border border-white/10 bg-[#1B1B1B] p-6"><h3 className="text-xl font-semibold">{title}</h3><p className="mt-3 text-base leading-7 text-[#A7A7A1]">{description}</p><button onClick={requireLogin} className="mt-5 text-base font-semibold text-[#8FC8AD] hover:text-white">Open {title.toLowerCase()} <ArrowRight className="ml-1 inline" size={16}/></button></article>)}</div>
          </div>
        </section>
        <section id="workflow" className="mx-auto max-w-6xl px-5 py-20 sm:px-8"><div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-center"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#E58F82]">Get started</p><h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Your next project starts here.</h2><p className="mt-4 max-w-2xl text-lg leading-8 text-[#A7A7A1]">Sign in to create repositories and manage your version control workspace.</p></div><button onClick={continueToLogin} className="rounded-xl bg-[#438C89] px-6 py-3.5 text-base font-semibold text-white hover:bg-[#367C79]">Sign in to continue</button></div></section>
        <footer id="about" className="border-t border-white/[0.08] px-5 py-6 text-center text-sm text-[#888883]">HAKI · Version Control Workspace · <a href="/about" className="underline decoration-white/30 underline-offset-4 hover:text-white">About HAKI</a></footer>
        </>}
      </main>

      {loginPrompt && <div role="status" className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-xl border border-white/15 bg-[#202020] px-5 py-3 text-base font-medium text-white shadow-2xl">{loginPrompt}</div>}

    </div>
  );
}

function ExtraPage({ children, title, user, onUserUpdate, onSignOut, theme, onThemeToggle }) {
  return (
    <div className="extra-page page-enter min-h-screen bg-[#FAF8F1] text-[#4F574F] dark:bg-[#09090b] dark:text-gray-100" data-theme={theme}>
      <WorkspaceHeader
        user={user}
        onUserUpdate={onUserUpdate}
        onSignOut={onSignOut}
        title={title}
        theme={theme}
        onThemeToggle={onThemeToggle}
      />
      {children}
    </div>
  );
}

function ProtectedPage({ user, children }) {
  const location = useLocation();

  if (!user) {
    return <Navigate to="/" state={{ loginRequired: true, from: location.pathname }} replace />;
  }

  return children;
}

function AppRoutes({ user, onAuth, onUserUpdate, onSignOut, theme, onThemeToggle, onThemeChange, githubSessionError }) {
  const location = useLocation();
  const returnTo = location.state?.from || "/";

  return (
    <Routes>
      <Route
        path="/reset-password"
        element={<PasswordResetPage />}
      />
      <Route
        path="/"
        element={
          user ? (
            <Dashboard
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
              theme={theme}
              onThemeToggle={onThemeToggle}
            />
          ) : (
            <PublicHome onAuth={onAuth} theme={theme} onThemeToggle={onThemeToggle} githubSessionError={githubSessionError} />
          )
        }
      />

      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={returnTo} replace />
          ) : (
            <Navigate to="/" state={{ openLogin: true, from: location.state?.from || "/" }} replace />
          )
        }
      />

      <Route
        path="/repositories/:id/:fileId?"
        element={
          <ProtectedPage user={user}>
            <RepositoryWorkspace
              key={location.pathname}
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
              theme={theme}
              onThemeToggle={onThemeToggle}
            />
          </ProtectedPage>
        }
      />

      <Route
        path="/setting"
        element={
          <ProtectedPage user={user}>
            <ExtraPage
              title="Settings"
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
              theme={theme}
              onThemeToggle={onThemeToggle}
            >
              <SettingPage user={user} onUserUpdate={onUserUpdate} theme={theme} onThemeChange={onThemeChange} />
            </ExtraPage>
          </ProtectedPage>
        }
      />

      <Route
        path="/about"
        element={user ? <ExtraPage title="About HAKI" user={user} onUserUpdate={onUserUpdate} onSignOut={onSignOut} theme={theme} onThemeToggle={onThemeToggle}><AboutPage hideHeader /></ExtraPage> : <AboutPage />}
      />

      <Route
        path="/import"
        element={
          <ProtectedPage user={user}>
            <ExtraPage
              title="Import repository"
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
              theme={theme}
              onThemeToggle={onThemeToggle}
            >
              <ImportRepository />
            </ExtraPage>
          </ProtectedPage>
        }
      />

      <Route
        path="/governance"
        element={<ProtectedPage user={user}><ExtraPage title="Code Governance" user={user} onUserUpdate={onUserUpdate} onSignOut={onSignOut} theme={theme} onThemeToggle={onThemeToggle}><GovernancePage /></ExtraPage></ProtectedPage>}
      />
      <Route
        path="/teams"
        element={<ProtectedPage user={user}><ExtraPage title="Teams" user={user} onUserUpdate={onUserUpdate} onSignOut={onSignOut} theme={theme} onThemeToggle={onThemeToggle}><TeamsPage user={user} /></ExtraPage></ProtectedPage>}
      />
      <Route
        path="/create"
        element={
          <ProtectedPage user={user}>
            <Navigate to="/import" replace />
          </ProtectedPage>
       
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem("hakiTheme")?.toLowerCase() === "light" ? "light" : "dark");
  const [checkingSession, setCheckingSession] = useState(true);
  const [showLoader, setShowLoader] = useState(false);
  const [githubSessionError, setGithubSessionError] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("hakiTheme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    const loaderTimer = window.setTimeout(() => setShowLoader(true), 100);
    const callbackUrl = new URL(window.location.href);
    const isGitHubCallback = callbackUrl.searchParams.get("auth") === "github";
    if (isGitHubCallback) {
      callbackUrl.searchParams.delete("auth");
      window.history.replaceState({}, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
    }
    refreshBackendSession()
      .then((result) => { setUser(result.user); setGithubSessionError(false); })
      .catch(() => { setUser(null); setGithubSessionError(isGitHubCallback); })
      .finally(() => setCheckingSession(false));
    return () => window.clearTimeout(loaderTimer);
  }, []);
  async function signOut() {
    try {
      await logoutAccount();
    } finally {
      localStorage.removeItem("haki_token");
      setUser(null);
      setGithubSessionError(false);
    }
  }

  return (
    <BrowserRouter>
      {checkingSession ? showLoader ? (
        <div className="app-loading" role="status" aria-live="polite" aria-label="Loading HAKI">
          <div className="app-loading-mark"><HakiLogo className="h-12 w-12"/></div>
          <span className="app-loading-name">HAKI<span>.</span></span>
          <span className="app-loading-track"><i /></span>
        </div>
      ) : null : (
        <AppRoutes
          user={user}
          onAuth={setUser}
          onUserUpdate={setUser}
          onSignOut={signOut}
          theme={theme}
          onThemeToggle={toggleTheme}
          onThemeChange={setTheme}
          githubSessionError={githubSessionError}
        />
      )}
    {!checkingSession && user && <Chatbot theme={theme} />}
    </BrowserRouter>
  );
}

export default App;
