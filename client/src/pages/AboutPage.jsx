
import { GitBranch, Code2,Users,ShieldCheck,Zap, GitCommit, ArrowRight, Target, Rocket, Layers3, CheckCircle2, Heart} from "lucide-react";
import { useNavigate } from "react-router-dom";

const AboutPage = () => {
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
    <div className="min-h-screen bg-[#FFF8F1] text-gray-900 overflow-hidden">

      {/* HERO SECTION */}
      <section className="relative border-b border-gray-200
        overflow-hidden">

        <div className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "radial-gradient(#000 1px, transparent 1px)",
            backgroundSize: "24px 24px"
          }}
        />

        <div className="absolute w-[500px] h-[500px]
          rounded-full bg-gray-100 blur-3xl -top-64
          right-0" />

        <div className="relative max-w-7xl mx-auto px-6
          sm:px-10 py-24 md:py-32">

          <div className="max-w-3xl">

            <div className="inline-flex items-center gap-2
              border border-gray-200 rounded-full px-4 py-2
              text-xs font-semibold tracking-wide text-gray-600
              mb-8">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              GET TO KNOW HAKI
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl
              font-bold tracking-tight leading-[1.08]">
              We build tools
              <br />
              for people who
              <br />
              <span className="text-gray-400">
                build the future.
              </span>
            </h1>

            <p className="text-gray-500 text-base sm:text-lg
              leading-8 max-w-2xl mt-8">
              Haki is a developer-focused version control
              workspace built to simplify how developers
              manage repositories, track changes and
              collaborate on code.
            </p>

            <div className="flex flex-wrap gap-4 mt-9">
              <button
                onClick={() => navigate("/")}
                className="bg-black text-white px-6 py-3.5
                  rounded-xl text-sm font-semibold
                  flex items-center gap-2 hover:bg-gray-800
                  transition"
              >
                Explore Haki
                <ArrowRight size={17} />
              </button>

              <button
                onClick={() => navigate("/setting")}
                className="border border-gray-200 px-6 py-3.5
                  rounded-xl text-sm font-semibold
                  hover:bg-gray-50 transition"
              >
                Explore Settings
              </button>
            </div>
          </div>

          {/* HERO VISUAL */}
          <div className="mt-20 relative max-w-4xl">

            <div className="rounded-2xl bg-[#09090b] p-5
              sm:p-8 shadow-2xl border border-gray-800">

              <div className="flex items-center justify-between
                border-b border-white/10 pb-5">

                <div className="flex items-center gap-3">
                  <div className="bg-white text-black p-2 rounded-lg">
                    <GitBranch size={21} />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold">
                      haki-project
                    </p>
                    <p className="text-gray-500 text-xs">
                      Main repository
                    </p>
                  </div>
                </div>

                <span className="text-xs text-green-400
                  bg-green-400/10 px-3 py-1.5 rounded-full">
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
                      className="bg-white/[0.06] border
                        border-white/10 rounded-xl p-5">
                      <Icon size={22} className="text-gray-300 mb-6" />
                      <p className="text-white font-semibold">
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
                text-gray-400 text-xs">
                <CheckCircle2 size={16} className="text-green-400" />
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
      <section className="bg-[#fafafa] border-y border-gray-100">
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
                    bg-black text-white flex items-center
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
                  bg-gray-100 flex items-center
                  justify-center group-hover:bg-black
                  group-hover:text-white transition">
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
        <div className="max-w-7xl mx-auto bg-[#09090b]
          rounded-3xl px-7 sm:px-16 py-16 sm:py-20
          text-center text-white relative overflow-hidden">

          <div className="absolute w-80 h-80 rounded-full
            bg-white/5 blur-3xl -top-40 left-1/3" />

          <div className="relative">
            <div className="mx-auto w-14 h-14 bg-white
              text-black rounded-2xl flex items-center
              justify-center mb-7">
              <Layers3 size={28} />
            </div>

            <h2 className="text-3xl sm:text-5xl
              font-bold tracking-tight">
              Your code. Your workflow.
              <br />
              Your Haki.
            </h2>

            <p className="text-gray-400 text-sm sm:text-base
              mt-6 max-w-xl mx-auto leading-7">
              Start organizing your projects and experience
              a better way to manage your development workflow.
            </p>

            <button
              onClick={() => navigate("/")}
              className="mt-9 bg-white text-black
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
            <div className="bg-black text-white p-2 rounded-lg">
              <GitBranch size={18} />
            </div>
            <span className="font-bold text-lg">Haki</span>
          </div>

          <p className="text-xs text-gray-400">
            © 2026 Haki. Built for developers.
          </p>

          <div className="flex items-center gap-2
            text-xs text-gray-400">
            Made with <Heart size={13} className="text-red-500" />
            for developers
          </div>
        </div>
      </footer>

    </div>
  );
};

export default AboutPage;
