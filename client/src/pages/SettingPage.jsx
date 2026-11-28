
import { useEffect, useState } from "react";
import { UserRound, Settings as SettingsIcon, Palette, Bell, ShieldCheck, GitBranch, ChevronRight, Camera, LockKeyhole, Mail, Globe, Trash2, Moon, Sun, Save, Eye, EyeOff, KeyRound, CheckCircle2, Upload,} from "lucide-react";
import { changeAccountPassword, createGitHubLink, getAccountSettings, updateAccountSettings, updateAccountProfile, updateProfileAvatar } from "../services/api";

const defaultProfile = {
  name: "",
  username: "",
  email: "",
  bio: "",
  location: "",
};

const defaultNotifications = {
  email: true,
  repository: true,
  pullRequest: true,
  security: true,
  product: false,
};

const defaultRepository = {
  defaultBranch: "main",
  visibility: "Private",
  autoInit: true,
};

// Reusable section heading
const SectionHeading = ({ title, description }) => (
  <div className="border-b border-gray-200 pb-5 mb-7">
    <h2 className="text-xl font-bold text-gray-900">
      {title}
    </h2>
    <p className="text-sm text-gray-500 mt-1">
      {description}
    </p>
  </div>
);

// Reusable toggle
const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`w-11 h-6 rounded-full relative shrink-0 transition-colors ${
      checked ? "bg-black" : "bg-gray-300"
    }`}
  >
    <span
      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
        checked ? "left-6" : "left-1"
      }`}
    />
  </button>
);

// Reusable notification row
const SettingRow = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 py-5 border-b border-gray-100 last:border-0">
    <div>
      <h4 className="text-sm font-semibold text-gray-800">
        {title}
      </h4>
      <p className="text-xs text-gray-500 mt-1">
        {description}
      </p>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);


const SettingPage = ({ user, onUserUpdate, theme: appTheme, onThemeChange }) => {
  const [active, setActive] = useState("Profile");

  const [profile, setProfile] = useState(() => ({ ...defaultProfile, name: user?.fullName || "", username: user?.username || "", email: user?.email || "", bio: user?.bio || "", location: user?.location || "" }));

  const [profileImage, setProfileImage] = useState(
    () => user?.avatarDataUrl || ""
  );

  const theme = appTheme || "dark";

  const [notifications, setNotifications] = useState(defaultNotifications);

  const [repo, setRepo] = useState(defaultRepository);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState({
    type: "",
    text: "",
  });

  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");
  const [imageError, setImageError] = useState("");
  const [githubLinkLoading, setGithubLinkLoading] = useState(false);

  useEffect(() => {
    getAccountSettings().then((settings) => {
      if (settings.notifications) setNotifications({ ...defaultNotifications, ...settings.notifications });
      if (settings.repository) setRepo({ ...defaultRepository, ...settings.repository });
      if (typeof settings.theme === "string" && settings.theme) {
        const nextTheme = settings.theme.toLowerCase() === "light" ? "light" : "dark";
        onThemeChange?.(nextTheme);
      }
    }).catch((error) => { setMessageType("error"); setMessage(error.message || "Unable to load account settings."); });
  }, [onThemeChange]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("github_link");
    if (!result) return;
    const messages = {
      success: "GitHub account connected. You can now sign in with GitHub.",
      already_linked: "That GitHub account is linked to a different HAKI account.",
      expired: "The GitHub linking request expired. Start again.",
      cancelled: "GitHub account linking was cancelled.",
      failed: "GitHub account linking failed. Try again.",
    };
    queueMicrotask(() => { setMessageType(result === "success" ? "success" : "error"); setMessage(messages[result] || messages.failed); });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  async function linkGitHubAccount() {
    setGithubLinkLoading(true);
    setMessage("");
    try {
      const result = await createGitHubLink();
      window.location.assign(result.authorizationUrl);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to start GitHub account linking.");
      setGithubLinkLoading(false);
    }
  }

  // Settings navigation
  const menu = [
    {
      title: "Personal",
      items: [
        { name: "Profile", icon: UserRound },
        { name: "Account", icon: SettingsIcon },
        { name: "Appearance", icon: Palette },
        { name: "Notifications", icon: Bell },
      ],
    },
    {
      title: "Access",
      items: [
        { name: "Security", icon: ShieldCheck },
        { name: "Repositories", icon: GitBranch },
      ],
    },
  ];

  // Common input style
  const inputClass =
    "w-full border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black focus:ring-1 focus:ring-black/10 transition bg-white text-gray-900";

  // Apply theme
  useEffect(() => {
    const applyTheme = () => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.dataset.theme = theme;
    };

    applyTheme();
    localStorage.setItem("hakiTheme", theme);
  }, [theme]);

  // Update profile fields
  const updateProfile = (e) => {
    const { name, value } = e.target;

    setProfile((prev) => ({
      ...prev,
      [name]: value,
    }));

    setSaved(false);
  };

  // Upload profile picture
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    setImageError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Only JPG, PNG and WEBP images are allowed.");
      e.target.value = "";
      return;
    }

    if (file.size > 1024 * 1024) {
      setImageError("Image size must be 1 MB or smaller.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = reader.result;

      updateProfileAvatar(image).then((result) => {
        localStorage.removeItem("hakiProfileImage");
        setProfileImage(image);
        onUserUpdate?.(result.user);
        setMessage("Profile picture updated successfully.");
        setTimeout(() => setMessage(""), 3000);
      }).catch((uploadError) => setImageError(uploadError.message || "Unable to save profile picture."));
    };

    reader.onerror = () => {
      setImageError("Unable to read image. Try another file.");
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Remove profile picture
  const removeImage = () => {
    updateProfileAvatar("").then((result) => {
      localStorage.removeItem("hakiProfileImage");
      setProfileImage("");
      onUserUpdate?.(result.user);
      setMessage("Profile picture removed.");
      setTimeout(() => setMessage(""), 3000);
    }).catch((uploadError) => setImageError(uploadError.message || "Unable to remove profile picture."));
  };

  // Save profile
  const saveProfile = async () => {
    try {
      const result = await updateAccountProfile(profile);
      onUserUpdate?.(result.user);
      setSaved(true);
      setMessageType("success");
      setMessage("Profile saved successfully.");

      window.dispatchEvent(
        new Event("haki-profile-updated")
      );

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save profile.");
    }
  };

  // Notification toggle
  const toggleNotification = (key) => {
    setNotifications((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));

    setSaved(false);
  };

  // Save all preferences
  const saveSettings = async () => {
    try {
      await updateAccountSettings({ notifications, repository: repo, theme });

      setSaved(true);
      setMessageType("success");
      setMessage("Settings saved successfully.");

      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessageType("error");
      setMessage(error.message || "Unable to save settings.");
    }
  };

  // Password input
  const updatePassword = (e) => {
    setPasswords((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));

    setPasswordMessage({ type: "", text: "" });
  };

  // Change the password through the HAKI API.
  const handlePasswordChange = async (e) => {
    e.preventDefault();

    setPasswordMessage({ type: "", text: "" });

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = passwords;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Please fill all password fields.",
      });
      return;
    }

    if (newPassword.length < 12) {
      setPasswordMessage({
        type: "error",
        text: "New password must contain at least 12 characters.",
      });
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password must be different from current password.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "New password and confirm password do not match.",
      });
      return;
    }

    try {
      setPasswordLoading(true);

      const data = await changeAccountPassword({ currentPassword, newPassword });

      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setPasswordMessage({
        type: "success",
        text: data.message || "Password updated successfully.",
      });
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error.message || "Something went wrong.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-[#FFF8F1] dark:bg-[#09090b] text-gray-900 dark:text-gray-100 transition-colors">

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">

        {/* PAGE HEADING */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold dark:text-white">
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your account and workspace preferences.
          </p>
          <p className="mt-3 max-w-3xl rounded-xl border border-[#E8D9DE] bg-white/75 px-4 py-3 text-xs leading-5 text-[#706B79]">Profile and workspace preferences are saved to your HAKI account.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[230px_minmax(0,1fr)] gap-8">

          {/* SIDEBAR */}
          <aside className="space-y-6">

            {menu.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-3">
                  {group.title}
                </p>

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const selected = active === item.name;

                    return (
                      <button
                        key={item.name}
                        onClick={() => {
                          setActive(item.name);
                          setSaved(false);
                          setMessage("");
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                          selected
                            ? "bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-semibold"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Icon size={18} />
                        {item.name}

                        {selected && (
                          <ChevronRight size={15} className="ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          </aside>

          {/* MAIN CONTENT */}
          <main className="min-w-0">

            <div className="bg-white dark:bg-[#111] border border-gray-200 dark:border-gray-800 rounded-xl p-5 sm:p-8">

              {/* PROFILE */}
              {active === "Profile" && (
                <>
                  <SectionHeading
                    title="Public profile"
                    description="Manage your public profile information."
                  />

                  {/* PROFILE PICTURE */}
                  <div className="flex flex-wrap items-center gap-5 mb-9">

                    <div className="relative">
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                        {profileImage ? (
                          <img
                            src={profileImage}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserRound size={40} className="text-gray-400" />
                        )}
                      </div>

                      <label
                        htmlFor="profileUpload"
                        className="absolute bottom-0 right-0 w-8 h-8 bg-black text-white rounded-full flex items-center justify-center cursor-pointer border-2 border-white hover:bg-gray-700 transition"
                      >
                        <Camera size={15} />
                      </label>

                      <input
                        id="profileUpload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm dark:text-white">
                        Profile picture
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        Upload a picture to personalize your account.
                      </p>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <label
                          htmlFor="profileUpload"
                          className="inline-flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <Upload size={15} />
                          Upload photo
                        </label>

                        {profileImage && (
                          <button
                            onClick={removeImage}
                            className="inline-flex items-center gap-2 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm hover:bg-red-50"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-2">
                        PNG, JPG or WEBP · Maximum 1 MB
                      </p>
                    </div>
                  </div>

                  {imageError && (
                    <p className="text-sm text-red-600 mb-5">
                      {imageError}
                    </p>
                  )}

                  {/* PROFILE FIELDS */}
                  <div className="space-y-5 max-w-2xl">

                    {[
                      ["name", "Full name", "Enter your full name"],
                      ["username", "Username", "Enter username"],
                      ["email", "Email address", "Enter email"],
                      ["location", "Location", "Enter location"],
                    ].map(([key, label, placeholder]) => (
                      <div key={key}>
                        <label className="text-sm font-semibold dark:text-gray-200">
                          {label}
                        </label>

                        <input
                          type={key === "email" ? "email" : "text"}
                          name={key}
                          value={profile[key] || ""}
                          onChange={updateProfile}
                          disabled={key === "email"}
                          placeholder={placeholder}
                          className={`${inputClass} mt-2 disabled:cursor-not-allowed disabled:bg-gray-100 dark:bg-[#181818] dark:border-gray-700 dark:text-white`}
                        />
                      </div>
                    ))}

                    <div>
                      <label className="text-sm font-semibold dark:text-gray-200">
                        Bio
                      </label>

                      <textarea
                        name="bio"
                        value={profile.bio || ""}
                        onChange={updateProfile}
                        rows={4}
                        maxLength={250}
                        placeholder="Write something about yourself..."
                        className={`${inputClass} mt-2 resize-none dark:bg-[#181818] dark:border-gray-700 dark:text-white`}
                      />

                      <p className="text-xs text-gray-400 text-right mt-1">
                        {(profile.bio || "").length}/250
                      </p>
                    </div>
                  </div>
                </>
              )}

              {/* ACCOUNT */}
              {active === "Account" && (
                <>
                  <SectionHeading
                    title="Account settings"
                    description="Manage your Haki account information."
                  />

                  <div className="space-y-5">

                    <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Mail size={21} />
                        <div>
                          <h3 className="font-semibold text-sm">
                            Email address
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {profile.email || "No email added"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl">
                      <div className="flex items-center gap-3">
                        <Globe size={21} />
                        <div>
                          <h3 className="font-semibold text-sm">
                            Location
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {profile.location || "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl">
                      <h3 className="font-semibold text-sm">
                        Account username
                      </h3>
                      <p className="text-xs text-gray-500 mt-2">
                        @{profile.username || "username"}
                      </p>
                    </div>

                    <div className="p-5 border border-red-200 rounded-xl">
                      <div className="flex items-center gap-2 text-red-600 font-semibold">
                        <Trash2 size={18} />
                        Delete account
                      </div>
                      <p className="text-sm text-gray-500 mt-2">
                        Account deletion requires server-side confirmation and cannot be performed from this settings screen.
                      </p>
                    </div>

                  </div>
                </>
              )}

              {/* APPEARANCE */}
              {active === "Appearance" && (
                <>
                  <SectionHeading
                    title="Appearance"
                    description="Customize how Haki looks on your device."
                  />

                  <h3 className="text-sm font-semibold mb-5 dark:text-white">
                    Interface theme
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {[
                      { name: "light", label: "Light", icon: Sun },
                      { name: "dark", label: "Dark", icon: Moon },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            onThemeChange?.(item.name);
                            setSaved(false);
                          }}
                          aria-pressed={theme === item.name}
                          className={`border rounded-xl p-5 text-left transition ${
                            theme === item.name
                              ? "border-black dark:border-white bg-gray-50 dark:bg-gray-800"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-400"
                          }`}
                        >
                          <Icon size={25} className="mb-5" />

                          <p className="font-semibold text-sm">
                            {item.label}
                          </p>

                          <p className="text-xs text-gray-400 mt-1">{item.label} mode</p>

                          {theme === item.name && (
                            <CheckCircle2 size={17} className="mt-4" />
                          )}
                        </button>
                      );
                    })}

                  </div>

                  <p className="text-xs text-gray-400 mt-6">
                    Theme applies across your HAKI workspace and is saved with your account preferences.
                  </p>
                </>
              )}

              {/* NOTIFICATIONS */}
              {active === "Notifications" && (
                <>
                  <SectionHeading
                    title="Notifications"
                    description="Choose which updates you want to receive."
                  />

                  <SettingRow
                    title="Email notifications"
                    description="Receive important updates through email."
                    checked={notifications.email}
                    onChange={() => toggleNotification("email")}
                  />

                  <SettingRow
                    title="Repository activity"
                    description="Get notified about repository changes."
                    checked={notifications.repository}
                    onChange={() => toggleNotification("repository")}
                  />

                  <SettingRow
                    title="Pull request updates"
                    description="Updates about pull requests and reviews."
                    checked={notifications.pullRequest}
                    onChange={() => toggleNotification("pullRequest")}
                  />

                  <SettingRow
                    title="Security alerts"
                    description="Important security and account alerts."
                    checked={notifications.security}
                    onChange={() => toggleNotification("security")}
                  />

                  <SettingRow
                    title="Product announcements"
                    description="News about new Haki features."
                    checked={notifications.product}
                    onChange={() => toggleNotification("product")}
                  />
                </>
              )}

              {/* SECURITY */}
              {active === "Security" && (
                <>
                  <SectionHeading
                    title="Password & security"
                    description="Keep your Haki account secure."
                  />

                  <div className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      <GitBranch size={20} />
                      <div>
                        <h3 className="text-sm font-semibold">GitHub account</h3>
                        <p className="mt-1 text-xs text-gray-500">{user?.linkedProviders?.includes("GITHUB") ? "Connected for GitHub sign-in." : "Connect GitHub to use it for future sign-ins."}</p>
                      </div>
                    </div>
                    {!user?.linkedProviders?.includes("GITHUB") && <button type="button" onClick={linkGitHubAccount} disabled={githubLinkLoading} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">{githubLinkLoading ? "Connecting…" : "Connect GitHub"}</button>}
                  </div>

                  <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-7">
                    <div className="w-10 h-10 bg-white dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <ShieldCheck size={22} />
                    </div>

                    <div>
                      <h3 className="font-semibold text-sm">
                        Change password
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        Choose a strong password that you don't use elsewhere.
                      </p>
                    </div>
                  </div>

                  <form
                    onSubmit={handlePasswordChange}
                    className="max-w-xl space-y-5"
                  >

                    {[
                      ["currentPassword", "Current password"],
                      ["newPassword", "New password"],
                      ["confirmPassword", "Confirm new password"],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <label className="text-sm font-semibold dark:text-gray-200">
                          {label}
                        </label>

                        <div className="relative mt-2">
                          <KeyRound
                            size={17}
                            className="absolute left-4 top-3.5 text-gray-400"
                          />

                          <input
                            type={showPasswords ? "text" : "password"}
                            name={key}
                            value={passwords[key]}
                            onChange={updatePassword}
                            placeholder={`Enter ${label.toLowerCase()}`}
                            minLength={key !== "currentPassword" ? 12 : undefined}
                            required
                            className={`${inputClass} pl-11 pr-12 dark:bg-[#181818] dark:border-gray-700 dark:text-white`}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-black dark:hover:text-white"
                    >
                      {showPasswords ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}

                      {showPasswords ? "Hide passwords" : "Show passwords"}
                    </button>

                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <p className="text-xs font-semibold mb-2">
                        Password requirements
                      </p>

                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>• Minimum 12 characters</li>
                        <li>• Must be different from current password</li>
                        <li>• Both new password fields must match</li>
                      </ul>
                    </div>

                    {passwordMessage.text && (
                      <div className={`p-3 rounded-lg text-sm ${
                        passwordMessage.type === "success"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-600"
                      }`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="bg-black text-white rounded-lg px-5 py-3 text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
                    >
                      <LockKeyhole size={16} />
                      {passwordLoading
                        ? "Updating..."
                        : "Update password"}
                    </button>

                  </form>
                </>
              )}

              {/* REPOSITORIES */}
              {active === "Repositories" && (
                <>
                  <SectionHeading
                    title="Repository settings"
                    description="Configure your default repository preferences."
                  />

                  <div className="max-w-xl space-y-7">

                    <div>
                      <label className="text-sm font-semibold dark:text-white">
                        Default branch name
                      </label>

                      <input
                        value={repo.defaultBranch}
                        onChange={(e) => {
                          setRepo({
                            ...repo,
                            defaultBranch: e.target.value,
                          });
                          setSaved(false);
                        }}
                        className={`${inputClass} mt-2 dark:bg-[#181818] dark:border-gray-700 dark:text-white`}
                        placeholder="main"
                      />

                      <p className="text-xs text-gray-400 mt-2">
                        Default branch for newly created repositories.
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-semibold dark:text-white">
                        Default visibility
                      </label>

                      <select
                        value={repo.visibility}
                        onChange={(e) => {
                          setRepo({
                            ...repo,
                            visibility: e.target.value,
                          });
                          setSaved(false);
                        }}
                        className={`${inputClass} mt-2 dark:bg-[#181818] dark:border-gray-700 dark:text-white`}
                      >
                        <option>Private</option>
                        <option>Public</option>
                      </select>
                    </div>

                    <SettingRow
                      title="Initialize with README"
                      description="Automatically create README for new repositories."
                      checked={repo.autoInit}
                      onChange={() => {
                        setRepo({
                          ...repo,
                          autoInit: !repo.autoInit,
                        });
                        setSaved(false);
                      }}
                    />

                  </div>
                </>
              )}

              {/* FOOTER ACTIONS */}
              <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-4">

                <div>
                  {message && (
                    <p role={messageType === "error" ? "alert" : "status"} className={`text-sm ${messageType === "error" ? "text-red-600" : "text-green-600"}`}>
                      {message}
                    </p>
                  )}

                  {!message && (
                    <p className="text-xs text-gray-400">
                      {saved ? "All changes saved." : "Remember to save your changes."}
                    </p>
                  )}
                </div>

                {active !== "Security" && active !== "Account" && (
                  <button
                    onClick={
                      active === "Profile"
                        ? saveProfile
                        : saveSettings
                    }
                    className="bg-black text-white rounded-lg px-5 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-gray-800 transition"
                  >
                    <Save size={16} />
                    Save changes
                  </button>
                )}

              </div>

            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default SettingPage;
