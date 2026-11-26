
import { useEffect, useState } from "react";
import { UserRound, Settings as SettingsIcon, Palette, Bell, ShieldCheck, GitBranch, ChevronRight, Camera, LockKeyhole, Mail, Globe, Trash2, Sun, Moon, Save, Eye, EyeOff, KeyRound, CheckCircle2, Upload,} from "lucide-react";
import { changeAccountPassword, updateAccountProfile, updateProfileAvatar } from "../services/api";

const readStorage = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

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

const SettingPage = ({ user, onUserUpdate, theme, onThemeChange }) => {
  const [active, setActive] = useState("Profile");

  const [profile, setProfile] = useState(() => ({ ...defaultProfile, name: user?.fullName || "", username: user?.username || "", email: user?.email || "", ...readStorage("hakiProfile", {}) }));

  const [profileImage, setProfileImage] = useState(
    () => user?.avatarDataUrl || localStorage.getItem("hakiProfileImage") || ""
  );

  const [notifications, setNotifications] = useState(() =>
    readStorage("hakiNotifications", defaultNotifications)
  );

  const [repo, setRepo] = useState(() =>
    readStorage("hakiRepository", defaultRepository)
  );

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
  const [imageError, setImageError] = useState("");

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
    "w-full border border-[#E1E3E8] rounded-lg px-4 py-3 text-sm outline-none focus:border-[#D4D7DD] focus:ring-1 focus:ring-[#D4D7DD]/30 transition bg-white text-[#4F574F]";

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
      localStorage.setItem("hakiProfile", JSON.stringify(profile));
      onUserUpdate?.(result.user);
      setSaved(true);
      setMessage("Profile saved successfully.");

      window.dispatchEvent(
        new Event("haki-profile-updated")
      );

      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Unable to save profile.");
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
  const saveSettings = () => {
    try {
      localStorage.setItem(
        "hakiNotifications",
        JSON.stringify(notifications)
      );

      localStorage.setItem(
        "hakiRepository",
        JSON.stringify(repo)
      );

      localStorage.setItem("hakiTheme", theme);

      setSaved(true);
      setMessage("Settings saved successfully.");

      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Unable to save settings.");
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

  // Change password in the local preview store.
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

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "New password must contain at least 8 characters.",
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
        text: data.message || "Password changed in this browser preview.",
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
        checked ? "bg-[#727F8F]" : "bg-[#D9DCE2]"
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

  return (
    <div className="min-h-screen bg-[#FAF8F1]  text-gray-900  transition-colors">

      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">

        {/* PAGE HEADING */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold ">
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your account and workspace preferences.
          </p>
          <p className="mt-3 max-w-3xl rounded-xl border border-[#E5E7EC] bg-white/75 px-4 py-3 text-xs leading-5 text-[#666B63]">Frontend preview: data stays in this browser. It does not provide production account security or send email.</p>
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
                            ? "bg-[#F0F1F4]  text-[#4F574F]  font-semibold"
                            : "text-gray-600  hover:bg-[#F0F1F4] "
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

            <div className="bg-white  border border-gray-200  rounded-xl p-5 sm:p-8">

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
                      <div className="w-24 h-24 rounded-full overflow-hidden bg-[#F0F1F4]  border border-gray-200  flex items-center justify-center">
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
                        className="absolute bottom-0 right-0 w-8 h-8 bg-[#E0E4EA] text-[#4F574F] rounded-full flex items-center justify-center cursor-pointer border-2 border-white hover:bg-[#EEF0F4] transition"
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
                      <h3 className="font-semibold text-sm ">
                        Profile picture
                      </h3>

                      <p className="text-xs text-gray-500 mt-1">
                        Upload a picture to personalize your account.
                      </p>

                      <div className="flex flex-wrap gap-2 mt-3">
                        <label
                          htmlFor="profileUpload"
                          className="inline-flex items-center gap-2 border border-gray-200  rounded-lg px-3 py-2 text-sm font-medium cursor-pointer hover:bg-[#F7F5EE] "
                        >
                          <Upload size={15} />
                          Upload photo
                        </label>

                        {profileImage && (
                          <button
                            onClick={removeImage}
                            className="inline-flex items-center gap-2 border border-[#E2D8C8] text-[#8C7967] rounded-lg px-3 py-2 text-sm hover:bg-[#F1E8DD]"
                          >
                            <Trash2 size={15} />
                            Remove
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-gray-400 mt-2">
                        PNG, JPG or WEBP · Maximum 2MB
                      </p>
                    </div>
                  </div>

                  {imageError && (
                    <p className="text-sm text-[#8C7967] mb-5">
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
                        <label className="text-sm font-semibold ">
                          {label}
                        </label>

                        <input
                          type={key === "email" ? "email" : "text"}
                          name={key}
                          value={profile[key] || ""}
                          onChange={updateProfile}
                          placeholder={placeholder}
                          className={`${inputClass} mt-2   `}
                        />
                      </div>
                    ))}

                    <div>
                      <label className="text-sm font-semibold ">
                        Bio
                      </label>

                      <textarea
                        name="bio"
                        value={profile.bio || ""}
                        onChange={updateProfile}
                        rows={4}
                        maxLength={250}
                        placeholder="Write something about yourself..."
                        className={`${inputClass} mt-2 resize-none   `}
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

                    <div className="p-5 border border-gray-200  rounded-xl">
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

                    <div className="p-5 border border-gray-200  rounded-xl">
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

                    <div className="p-5 border border-gray-200  rounded-xl">
                      <h3 className="font-semibold text-sm">
                        Account username
                      </h3>
                      <p className="text-xs text-gray-500 mt-2">
                        @{profile.username || "username"}
                      </p>
                    </div>

                    <div className="p-5 border border-[#E2D8C8] rounded-xl">
                      <div className="flex items-center gap-2 text-[#8C7967] font-semibold">
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

                  <h3 className="text-sm font-semibold mb-5 ">
                    Interface theme
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    {[
                      { name: "Light", value: "light", icon: Sun, accent: "text-[#867C70]" },
                      { name: "Dark", value: "dark", icon: Moon, accent: "text-[#7E8998]" },
                    ].map((item) => {
                      const Icon = item.icon;

                      return (
                        <button
                          key={item.name}
                          onClick={() => {
                            onThemeChange(item.value);
                            setSaved(false);
                          }}
                          className={`border rounded-xl p-5 text-left transition ${
                            theme === item.value
                              ? "border-[#687386] bg-[#687386]/10"
                              : "border-[#E1E3E8] hover:border-[#D0D5DE]"
                          }`}
                        >
                          <Icon size={25} className={`mb-5 ${item.accent}`} />

                          <p className="font-semibold text-sm">
                            {item.name}
                          </p>

                          <p className="text-xs text-gray-400 mt-1">Use the {item.name.toLowerCase()} color theme</p>

                          {theme === item.value && (
                            <CheckCircle2 size={17} className="mt-4" />
                          )}
                        </button>
                      );
                    })}

                  </div>

                  <p className="text-xs text-gray-400 mt-6">
                    Your choice is saved and follows you throughout HAKI.
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

                  <div className="flex items-start gap-4 p-4 bg-[#F7F5EE]  rounded-xl mb-7">
                    <div className="w-10 h-10 bg-white  rounded-lg flex items-center justify-center">
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
                        <label className="text-sm font-semibold ">
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
                            minLength={key !== "currentPassword" ? 8 : undefined}
                            required
                            className={`${inputClass} pl-11 pr-12   `}
                          />
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="flex items-center gap-2 text-xs text-gray-500 hover:text-[#4F574F] "
                    >
                      {showPasswords ? (
                        <EyeOff size={15} />
                      ) : (
                        <Eye size={15} />
                      )}

                      {showPasswords ? "Hide passwords" : "Show passwords"}
                    </button>

                    <div className="bg-[#F7F5EE]  rounded-lg p-4">
                      <p className="text-xs font-semibold mb-2">
                        Password requirements
                      </p>

                      <ul className="text-xs text-gray-500 space-y-1">
                        <li>• Minimum 8 characters</li>
                        <li>• Must be different from current password</li>
                        <li>• Both new password fields must match</li>
                      </ul>
                    </div>

                    {passwordMessage.text && (
                      <div className={`p-3 rounded-lg text-sm ${
                        passwordMessage.type === "success"
                          ? "bg-[#EEF0F4] text-[#637080]"
                          : "bg-[#F1E8DD] text-[#8C7967]"
                      }`}>
                        {passwordMessage.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="bg-[#E0E4EA] text-[#4F574F] rounded-lg px-5 py-3 text-sm font-semibold hover:bg-[#E8EBF0] disabled:opacity-50 flex items-center gap-2"
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
                      <label className="text-sm font-semibold ">
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
                        className={`${inputClass} mt-2   `}
                        placeholder="main"
                      />

                      <p className="text-xs text-gray-400 mt-2">
                        Default branch for newly created repositories.
                      </p>
                    </div>

                    <div>
                      <label className="text-sm font-semibold ">
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
                        className={`${inputClass} mt-2   `}
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
              <div className="mt-10 pt-6 border-t border-gray-200  flex flex-wrap items-center justify-between gap-4">

                <div>
                  {message && (
                    <p className="text-sm text-[#637080]">
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
                    className="bg-[#E0E4EA] text-[#4F574F] rounded-lg px-5 py-3 text-sm font-semibold flex items-center gap-2 hover:bg-[#E8EBF0] transition"
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
