
import { GitBranch, Code2,Users,ShieldCheck,Zap, GitCommit, ArrowRight, Target, Rocket, Layers3, CheckCircle2, Heart} from "lucide-react";
import { useNavigate } from "react-router-dom";
import HakiLogo from "../components/HakiLogo";

const AboutPage = ({ hideHeader = false }) => {
  const navigate = useNavigate();

  const features = [
    {
      icon: GitBranch,
      title: "Version Control",
      description:
        "Track every change in your code and maintain complete control over your development history."
    },
    {
      icon: Code2,
      title: "Developer First",
      description:
        "A clean and intuitive workspace designed to make coding and repository management easier."
    },
    {
      icon: Users,
      title: "Collaboration",
      description:
        "Work together, share repositories and make development a collaborative experience."
    },
    {
      icon: ShieldCheck,
      title: "Secure Workspace",
      description:
        "Keep your projects organized with a focus on security and reliable repository management."
    },
    {
      icon: GitCommit,
      title: "Track Progress",
      description:
        "Keep track of commits, project history and every important milestone."
    },
    {
      icon: Zap,
      title: "Simple Workflow",
      description:
        "Spend less time managing projects and more time building something meaningful."
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Our Mission",
      description:
        "Our mission is to make version control simple and accessible for every developer. We want to provide a workspace where managing code, tracking changes and organizing projects feels effortless."
    },
    {
      icon: Rocket,
      title: "Our Vision",
      description:
        "We envision a development ecosystem where developers can focus on creativity and innovation without worrying about complicated project management workflows."
    }
  ];

  return (
    <div className="about-page min-h-screen bg-[#FAF8F1] text-gray-900 overflow-hidden" data-theme={document.documentElement.dataset.theme || "dark"}>
      {!hideHeader && <header className="flex items-center justify-between border-b border-gray-200 bg-[#FAF8F1] px-5 py-4 sm:px-10">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xl font-bold tracking-tight"><HakiLogo className="h-10 w-10"/>HAKI<span className="text-[#438C89]">.</span></button>
        <nav className="flex items-center gap-5 text-sm font-medium"><button onClick={() => navigate("/")} className="hover:opacity-70">Home</button><button onClick={() => navigate("/", { state: { openLogin: true } })} className="rounded-lg bg-[#438C89] px-4 py-2 text-white hover:bg-[#367C79]">Log in</button></nav>
      </header>}

      {/* HERO SECTION */}
      <section className="relative border-b border-gray-200
        overflow-hidden">

        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(#7B8076 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />

        <div className="absolute w-[500px] h-[500px]
          rounded-full bg-[#F0F1F4] blur-3xl -top-64
          right-0" />

        <div className={`relative max-w-7xl mx-auto px-6 sm:px-10 ${hideHeader ? "py-16 md:py-20" : "py-20 md:py-28"}`}>

          <div className="max-w-3xl">

            <div className="about-reveal about-reveal-1 inline-flex items-center gap-2
              border border-gray-200 rounded-full px-4 py-2
              text-xs font-semibold tracking-wide text-gray-600
              mb-8">
              <span className="w-2 h-2 bg-[#727F8F] rounded-full" />
              GET TO KNOW HAKI
            </div>

            <h1 className="about-reveal about-reveal-2 text-6xl sm:text-7xl md:text-8xl
              font-bold tracking-tight leading-[1.08]">
              We build tools
              <br />
              for people who
              <br />
              <span className="text-gray-400">
                build the future.
              </span>
            </h1>

            <p className="about-reveal about-reveal-3 text-gray-500 text-base sm:text-lg
              leading-8 max-w-2xl mt-8">
              Haki is a developer-focused version control
              workspace built to simplify how developers
              manage repositories, track changes and
              collaborate on code.
            </p>

            <div className="about-reveal about-reveal-4 flex flex-wrap gap-4 mt-9">
              <button
                onClick={() => navigate("/")}
                className="bg-[#E0E4EA] text-[#4F574F] px-6 py-3.5
                  rounded-xl text-sm font-semibold
                  flex items-center gap-2 hover:bg-[#E8EBF0]
                  transition"
              >
                Explore Haki
                <ArrowRight size={17} />
              </button>

              <button
                onClick={() => navigate("/setting")}
                className="border border-gray-200 px-6 py-3.5
                  rounded-xl text-sm font-semibold
                  hover:bg-[#F7F5EE] transition"
              >
                Explore Settings
              </button>
            </div>
          </div>

          {/* HERO VISUAL */}
          <div className="about-reveal about-reveal-5 mt-20 relative max-w-4xl">

            <div className="rounded-2xl bg-[#EEF0F4] p-5
              sm:p-8 shadow-xl border border-[#D8DED2]">

              <div className="flex items-center justify-between
                border-b border-[#D8DED2] pb-5">

                <div className="flex items-center gap-3">
                  <div className="bg-white text-[#4F574F] p-2 rounded-lg">
                    <GitBranch size={21} />
                  </div>
                  <div>
                  <p className="text-[#4F574F] text-sm font-semibold">
                      haki-project
                    </p>
                    <p className="text-gray-500 text-xs">
                      Main repository
                    </p>
                  </div>
                </div>

                <span className="text-xs text-[#637080]
                  bg-[#E8EBF0] px-3 py-1.5 rounded-full">
                  ● All systems ready
                </span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4 mt-6">

                {[
                  { icon: GitBranch, title: "Branches", value: "Organized code" },
                  { icon: GitCommit, title: "Commits", value: "Track every change" },
                  { icon: Code2, title: "Repositories", value: "Manage projects" }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title}
                      className="bg-white border
                        border-[#E1E3E8] rounded-xl p-5">
                      <Icon size={22} className="text-[#697586] mb-6" />
                      <p className="text-[#4F574F] font-semibold">
                        {item.title}
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {item.value}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mt-7
                text-gray-600 text-xs">
                <CheckCircle2 size={16} className="text-[#637080]" />
                Designed for a better development workflow.
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-24">

        <div className="grid md:grid-cols-2 gap-16 items-center">

          <div>
            <p className="text-xs font-bold tracking-[3px]
              text-gray-400 uppercase mb-5">
              WHO WE ARE
            </p>

            <h2 className="text-4xl sm:text-5xl
              font-bold tracking-tight leading-tight">
              More than just
              <span className="text-gray-400"> version control.</span>
            </h2>
          </div>

          <div className="space-y-5 text-gray-500
            leading-8 text-sm sm:text-base">
            <p>
              Every great application starts with an idea
              and every great idea needs a place to grow.
            </p>

            <p>
              That's where Haki comes in. We aim to bring
              essential development tools together in one
              clean, organized and user-friendly platform.
            </p>

            <p>
              Whether you are working on your first project
              or managing multiple repositories, Haki is
              designed to make your workflow smoother.
            </p>
          </div>

        </div>
      </section>

      {/* MISSION / VISION */}
      <section className="bg-[#FBFAF6] border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-24">

          <div className="mb-12">
            <p className="text-xs font-bold tracking-[3px]
              text-gray-400 uppercase mb-4">
              WHAT DRIVES US
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Purpose behind the platform.
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            {values.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}
                  className="bg-white border border-gray-200
                    rounded-2xl p-8 sm:p-10
                    hover:border-gray-400 transition">

                  <div className="w-12 h-12 rounded-xl
                    bg-[#E0E4EA] text-[#4F574F] flex items-center
                    justify-center mb-7">
                    <Icon size={23} />
                  </div>

                  <h3 className="text-2xl font-bold mb-4">
                    {item.title}
                  </h3>

                  <p className="text-sm text-gray-500 leading-8">
                    {item.description}
                  </p>
                </div>
              );
            })}

          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-7xl mx-auto px-6 sm:px-10 py-24">

        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-xs font-bold tracking-[3px]
            text-gray-400 uppercase mb-4">
            WHY HAKI
          </p>

          <h2 className="text-3xl sm:text-4xl font-bold">
            Everything developers need.
          </h2>

          <p className="text-gray-500 text-sm leading-7 mt-4">
            Built around the essential tools and workflows
            that make software development better.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3
          gap-5">

          {features.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.title}
                className="group border border-gray-200
                  rounded-2xl p-7 hover:shadow-lg
                  hover:-translate-y-1 transition-all duration-300">

                <div className="w-12 h-12 rounded-xl
                  bg-[#F0F1F4] flex items-center
                  justify-center group-hover:bg-[#E0E4EA]
                  group-hover:text-[#4F574F] transition">
                  <Icon size={22} />
                </div>

                <h3 className="font-bold text-lg mt-6">
                  {item.title}
                </h3>

                <p className="text-sm text-gray-500
                  leading-7 mt-3">
                  {item.description}
                </p>

                <div className="mt-6 text-xs text-gray-300
                  font-semibold">
                  0{index + 1} / HAKI
                </div>
              </div>
            );
          })}

        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 sm:px-10 pb-24">
        <div className="max-w-7xl mx-auto bg-[#EEF0F4]
          rounded-3xl px-7 sm:px-16 py-16 sm:py-20
          text-center text-[#4F574F] relative overflow-hidden">

          <div className="absolute w-80 h-80 rounded-full
            bg-white/5 blur-3xl -top-40 left-1/3" />

          <div className="relative">
            <div className="mx-auto w-14 h-14 bg-white
              text-[#4F574F] rounded-2xl flex items-center
              justify-center mb-7">
              <Layers3 size={28} />
            </div>

            <h2 className="text-3xl sm:text-5xl
              font-bold tracking-tight">
              Your code. Your workflow.
              <br />
              Your Haki.
            </h2>

            <p className="text-gray-600 text-sm sm:text-base
              mt-6 max-w-xl mx-auto leading-7">
              Start organizing your projects and experience
              a better way to manage your development workflow.
            </p>

            <button
              onClick={() => navigate("/")}
              className="mt-9 bg-white text-[#4F574F]
                px-7 py-3.5 rounded-xl font-semibold
                text-sm inline-flex items-center gap-2
                hover:bg-gray-200 transition"
            >
              Get Started
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-10
          py-8 flex flex-col sm:flex-row
          items-center justify-between gap-5">

          <div className="flex items-center gap-2">
            <div className="bg-[#E0E4EA] text-[#4F574F] p-2 rounded-lg">
              <GitBranch size={18} />
            </div>
            <span className="font-bold text-lg">Haki</span>
          </div>

          <p className="text-xs text-gray-400">
            © 2026 Haki. Built for developers.
          </p>

          <div className="flex items-center gap-2
            text-xs text-gray-400">
            Made with <Heart size={13} className="text-[#8C7967]" />
            for developers
          </div>
        </div>
      </footer>

    </div>
  );
};

export default AboutPage;
