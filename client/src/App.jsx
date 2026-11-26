import { useEffect, useState } from "react";
import { LogIn } from 'lucide-react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import Chatbot from "./components/Chatbot.jsx"
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import ImportRepository from "./pages/ImportRepository";
import RepositoryWorkspace from "./pages/RepositoryWorkspace";
import SettingPage from "./pages/SettingPage";
import WorkspaceHeader from "./components/WorkspaceHeader";
import { refreshBackendSession, logoutAccount } from "./services/api";

function PublicHome({ onAuth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showLoginPopup, setShowLoginPopup] = useState(() => Boolean(location.state?.openLogin || new URLSearchParams(window.location.search).has("auth") || new URLSearchParams(window.location.search).has("auth_error")));
  const [oauthError, setOauthError] = useState(() => { const code = new URLSearchParams(window.location.search).get("auth_error"); const messages = { github_not_configured: "GitHub sign-in is not configured yet.", github_cancelled: "GitHub sign-in was cancelled. You can try again.", github_failed: "GitHub sign-in could not be completed. Please try again." }; return code ? messages[code] || "GitHub sign-in could not be completed." : ""; });
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

  function finishLogin(authenticatedUser) {
    onAuth(authenticatedUser);
    setShowLoginPopup(false);
    navigate(nextPath || "/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC] text-[#111827]">
      <header className="flex flex-col gap-4 border-b bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-5">
        <span className="text-3xl font-black">
          haki<span className="text-blue-500">.</span>
        </span>

        <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
                    <button
            onClick={() => askForLogin("/create")}
            className="flex-1 rounded-xl border border-slate-400 px-3 py-3 text-sm font-semibold sm:flex-none sm:px-5"
          >
            Create Repository
          </button>
<button
  onClick={continueToLogin}
  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-300 px-4 font-semibold shadow transition duration-200 hover:bg-slate-500 hover:text-white sm:flex-none sm:px-6"
>
  Login <LogIn size={18} />
</button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden min-h-[calc(100vh-77px)] w-72 shrink-0 bg-white p-7 md:block">
          <h2 className="mb-5 font-bold">WORKSPACE</h2>

          <button
            onClick={() => askForLogin("/")}
            className="mb-3 w-full rounded-xl bg-blue-50 p-4 text-left text-blue-500"
          >
            All Repository
          </button>

          <button
            onClick={() => askForLogin("/setting")}
            className="mb-3 w-full rounded-xl p-4 text-left text-slate-500 hover:bg-slate-50"
          >
            Settings
          </button>

          <button
            onClick={() => askForLogin("/about")}
            className="mb-8 w-full rounded-xl p-4 text-left text-slate-500 hover:bg-slate-50"
          >
            About Us
          </button>

          <h2 className="mb-5 font-bold">GET STARTED</h2>

          <button
            onClick={() => askForLogin("/import")}
            className="w-full rounded-xl p-4 text-left text-slate-500 hover:bg-slate-50"
          >
            Import Repository
          </button>
        </aside>

        <main className="min-w-0 flex-1 p-5 sm:p-8 md:p-12">
          <div className="mb-8 inline-block rounded-full bg-blue-50 px-5 py-3 text-sm font-semibold text-pink-500">
            YOUR DEVELOPER WORKSPACE
          </div>

          <h1 className="mb-5 text-4xl font-black leading-tight sm:text-5xl">
            Build. Manage.{" "}
            <span className="text-teal-500">Collaborate.</span>
          </h1>

          <p className="mb-12 max-w-3xl text-lg leading-8 text-slate-500">
            Everything you build deserves a place. Manage your repositories,
            track your projects and keep your development journey organized
            with Haki.
          </p>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              ["Repo", "Your repositories"],
              ["Project", "Your projects"],
              ["Activity", "Your activity"],
            ].map(([icon, title]) => (
              <button
                key={title}
                onClick={() => askForLogin("/")}
                className="rounded-2xl border bg-white p-7 text-left shadow-sm hover:shadow-md"
              >
                <span className="mb-6 block text-3xl text-blue-500">{icon}</span>
                <span className="block text-lg font-semibold">{title}</span>
                <span className="mt-2 block text-sm text-slate-500">
                  Log in to view your workspace
                </span>
              </button>
            ))}
          </div>

          <section className="mt-12 rounded-2xl border bg-white p-7">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">All Repositories</h2>
                <p className="mt-2 text-slate-500">
                  Log in to import and manage your repositories.
                </p>
              </div>

              <button
                onClick={() => askForLogin("/import")}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white"
              >
                Import Repository
              </button>
            </div>
          </section>
        </main>
      </div>

      {showLoginPopup && (
        <AuthPage
          embedded
          onClose={() => setShowLoginPopup(false)}
          onAuth={finishLogin}
          oauthError={oauthError}
        />
      )}
    </div>
  );
}

function ExtraPage({ children, title, user, onUserUpdate, onSignOut }) {
  return (
    <div className="min-h-screen bg-[#FFF8F1] text-[#302D3B]">
      <WorkspaceHeader
        user={user}
        onUserUpdate={onUserUpdate}
        onSignOut={onSignOut}
        title={title}
      />
      {children}
    </div>
  );
}

function ProtectedPage({ user, children }) {
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  return children;
}

function AppRoutes({ user, onAuth, onUserUpdate, onSignOut }) {
  const location = useLocation();
  const returnTo = location.state?.from || "/";

  return (
    <Routes>
      <Route
        path="/"
        element={
          user ? (
            <Dashboard
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
            />
          ) : (
            <PublicHome onAuth={onAuth} />
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
        path="/repositories/:id"
        element={
          <ProtectedPage user={user}>
            <RepositoryWorkspace
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
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
            >
              <SettingPage user={user} onUserUpdate={onUserUpdate} />
            </ExtraPage>
          </ProtectedPage>
        }
      />

      <Route
        path="/about"
        element={
          <ProtectedPage user={user}>
            <ExtraPage
              title="About HAKI"
              user={user}
              onUserUpdate={onUserUpdate}
              onSignOut={onSignOut}
            >
              <AboutPage />
            </ExtraPage>
          </ProtectedPage>
        }
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
            >
              <ImportRepository />
            </ExtraPage>
          </ProtectedPage>
        }
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
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    refreshBackendSession()
      .then((result) => setUser(result.user))
      .catch(() => localStorage.removeItem("haki_token"))
      .finally(() => setCheckingSession(false));
  }, []);
  async function signOut() {
    try {
      await logoutAccount();
    } finally {
      localStorage.removeItem("haki_token");
      setUser(null);
    }
  }

  return (
    <BrowserRouter>
      {checkingSession ? (
        <div className="flex min-h-screen items-center justify-center bg-[#F5F8FC] text-slate-600">
          Loading...
        </div>
      ) : (
        <AppRoutes
          user={user}
          onAuth={setUser}
          onUserUpdate={setUser}
          onSignOut={signOut}
        />
      )}
    {!checkingSession && user && <Chatbot />}
    </BrowserRouter>
  );
}

export default App;
