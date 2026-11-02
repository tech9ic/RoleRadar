import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BriefcaseBusiness, Search, Sparkles, ShieldCheck, FileText,
  ArrowRight, CheckCircle2, Zap, Lock, Moon, Sun,
  GraduationCap, Flame, Layers3, HelpCircle, ChevronDown, Check,
  Clock, Target
} from "lucide-react";
import type { Job, UserProfile } from "./types/job";
import { compactNumber } from "./utils/format";

interface LandingPageProps {
  jobs: Job[];
  meta: any;
  profile: UserProfile;
  goldCount: number;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
  onOpenJob?: (job: Job) => void;
}

export function LandingPage({
  jobs,
  meta,
  profile,
  goldCount,
  theme,
  setTheme,
  onOpenJob
}: LandingPageProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const totalJobsCount = meta?.uniqueJobs || jobs.length || 6675;
  const totalDeptsCount = meta?.departments?.length || 40;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/jobs?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/jobs");
    }
  };

  const handlePillClick = (term: string) => {
    navigate(`/jobs?q=${encodeURIComponent(term)}`);
  };

  const faqs = [
    {
      q: "Is my resume or personal data sent to any server?",
      a: "No, never! RoleRadar runs 100% in your browser. All resume decompression, skill parsing, bookmarks, and application tracking are stored exclusively in your local browser's IndexedDB and LocalStorage."
    },
    {
      q: "What makes a 'Golden Opportunity' (≥ 80% match)?",
      a: "Unlike generic boards that show superficial matches, RoleRadar enforces strict calibration: a role only earns the glowing Golden badge if it scores 80% or above, matches your experience level, and contains at least 2 key overlapping technical skills."
    },
    {
      q: "Can I add new Excel job sheets easily?",
      a: "Yes! RoleRadar uses continuous GitOps. Just drop any .xlsx file into the data/ directory and push to GitHub. GitHub Actions will automatically parse, normalize, and publish the updated dataset live in under 60 seconds."
    },
    {
      q: "Is RoleRadar completely free?",
      a: "Yes! It is open-source under the MIT license, requires no paid API keys or monthly cloud database bills, and is hosted for free on GitHub Pages."
    }
  ];

  return (
    <div className={`landing-wrapper ${theme}`}>
      {/* Top Notification Banner */}
      <div className="landing-top-banner">
        <span>
          <Flame size={14} className="banner-icon" /> <strong>RoleRadar v1.0 Live</strong> — Fully vibe-coded career workspace with in-browser resume match intelligence.
        </span>
        <button
          className="banner-cta-link"
          onClick={() => navigate("/dashboard")}
        >
          Open App <ArrowRight size={12} />
        </button>
      </div>

      {/* Main Landing Navbar */}
      <header className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-brand" onClick={() => navigate("/")}>
            <div className="landing-brand-mark">
              <BriefcaseBusiness size={22} />
            </div>
            <div>
              <div className="landing-brand-name">RoleRadar</div>
              <div className="landing-brand-tag">Career Intelligence</div>
            </div>
          </div>

          <nav className="landing-links">
            <a href="#features">Features</a>
            <a href="#match-radar">Match Radar</a>
            <a href="#vibe-coded">Vibe Story</a>
            <a href="#faq">FAQ</a>
            <button className="landing-link-btn" onClick={() => navigate("/jobs")}>
              Explore Jobs
            </button>
            <button className="landing-link-btn" onClick={() => navigate("/freshers")}>
              Fresher Jobs
            </button>
          </nav>

          <div className="landing-nav-actions">
            <button
              className="icon-button theme-toggle"
              title="Toggle theme"
              onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            >
              {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="landing-launch-btn"
              onClick={() => navigate("/dashboard")}
            >
              <span>Launch Workspace</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero-container">
          <div className="landing-pill">
            <Sparkles size={14} color="#F5B700" />
            <span>AI Match Engine · In-Browser Privacy · Continuous GitOps</span>
          </div>

          <h1 className="landing-hero-title">
            Spotlight Your <span className="gradient-gold-text">Golden Job Opportunities</span> in Seconds.
          </h1>

          <p className="landing-hero-subtitle">
            Stop scrolling through thousands of unranked listings. RoleRadar decompresses and analyzes your resume directly inside your browser, checks strict <strong>80%+ skill alignment</strong>, and pinpoints high-conviction roles tailored for you.
          </p>

          {/* Quick Search Bar */}
          <form className="landing-search-box" onSubmit={handleSearchSubmit}>
            <div className="landing-search-input-wrap">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by skill, title, company (e.g. Cybersecurity, React, Python, Bangalore)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="landing-search-btn">
              Search Jobs
            </button>
          </form>

          {/* Popular Tag Pills */}
          <div className="landing-tag-pills">
            <span className="pills-label">Trending:</span>
            <button type="button" onClick={() => handlePillClick("cybersecurity")}>Cybersecurity</button>
            <button type="button" onClick={() => handlePillClick("react")}>React & Frontend</button>
            <button type="button" onClick={() => handlePillClick("python")}>Python</button>
            <button type="button" onClick={() => navigate("/freshers")}>Fresher (0-1 yrs)</button>
            <button type="button" onClick={() => handlePillClick("remote")}>Remote</button>
            <button type="button" onClick={() => navigate("/jobs?match=gold")}>★ Golden (≥ 80%)</button>
          </div>

          {/* Hero CTAs */}
          <div className="landing-hero-actions">
            <button
              className="landing-primary-cta"
              onClick={() => navigate("/dashboard")}
            >
              <Zap size={18} />
              <span>Enter Workspace & Dashboard</span>
              <ArrowRight size={16} />
            </button>
            <button
              className="landing-secondary-cta"
              onClick={() => navigate("/jobs")}
            >
              <Search size={18} />
              <span>Browse {compactNumber(totalJobsCount)} Tech Jobs</span>
            </button>
            <button
              className="landing-ghost-cta"
              onClick={() => navigate("/profile")}
            >
              <FileText size={18} />
              <span>Upload Resume</span>
            </button>
          </div>

          {/* Trust & Metric Counters Strip */}
          <div className="landing-stats-strip">
            <div className="landing-stat-item">
              <strong>{compactNumber(totalJobsCount)}+</strong>
              <span>Curated Opportunities</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat-item">
              <strong>{totalDeptsCount}</strong>
              <span>Worksheets & Domains</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat-item">
              <strong style={{ color: "#F5B700" }}>≥ 80%</strong>
              <span>Strict Golden Bar</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat-item">
              <strong style={{ color: "#10B981" }}>100%</strong>
              <span>Client-Side Private</span>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Mockup Card Section (What a Gold Match Looks Like) */}
      <section className="landing-preview-section" id="match-radar">
        <div className="landing-section-header">
          <span className="section-badge">MATCH RADAR IN ACTION</span>
          <h2>See How RoleRadar Spots Your Dream Role</h2>
          <p>
            When you upload your resume or add your skills, RoleRadar scores every posting and highlights your highest-conviction matches with glowing visual clarity.
          </p>
        </div>

        <div className="landing-card-preview-container">
          <div className="landing-mock-job-card">
            <div className="mock-card-glow-badge">
              <Sparkles size={14} color="#F5B700" />
              <span>Golden Opportunity · 88% Match</span>
            </div>

            <div className="mock-card-header">
              <div>
                <h3>Entry / Associate Cybersecurity Analyst</h3>
                <span className="mock-company">Proofpoint · Security Operations · Bangalore (Hybrid)</span>
              </div>
              <span className="mock-date">Posted 2 days ago</span>
            </div>

            <div className="mock-meta-pills">
              <span>0-1 yrs experience</span>
              <span>Fresher eligible</span>
              <span>Full-Time</span>
              <span>₹8L - ₹14L / yr</span>
            </div>

            <div className="mock-skills-section">
              <strong>Matching Skills from Your Resume:</strong>
              <div className="mock-skills-list">
                <span className="mock-skill-match"><Check size={12} /> Cybersecurity</span>
                <span className="mock-skill-match"><Check size={12} /> Linux & Bash</span>
                <span className="mock-skill-match"><Check size={12} /> Python</span>
                <span className="mock-skill-match"><Check size={12} /> Network Security</span>
                <span className="mock-skill-match"><Check size={12} /> SOC Fundamentals</span>
              </div>
            </div>

            <div className="mock-pitch-preview">
              <div className="mock-pitch-header">
                <Zap size={14} color="var(--blue)" />
                <strong>1-Click Generated Recruiter Pitch:</strong>
              </div>
              <p>
                "Hi Proofpoint Hiring Team, with my hands-on background in Network Security, Log Analysis, and Linux, I believe my skill set aligns strongly with what you are looking for..."
              </p>
            </div>

            <div className="mock-card-actions">
              <button className="button button-primary" onClick={() => navigate("/jobs?match=gold")}>
                View Golden Matches in App
              </button>
              <button className="button button-secondary" onClick={() => navigate("/dashboard")}>
                Try With Your Resume
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Core Feature Pillars */}
      <section className="landing-features" id="features">
        <div className="landing-section-header">
          <span className="section-badge">ENGINEERED FOR SPEED & PRIVACY</span>
          <h2>Why Ambitious Engineers Choose RoleRadar</h2>
          <p>Built from the ground up for modern job discovery without corporate clutter or monthly fees.</p>
        </div>

        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="feature-icon-wrap gold-glow">
              <Sparkles size={24} color="#F5B700" />
            </div>
            <h3>Strict Golden Match Bar (≥ 80%)</h3>
            <p>
              No fake scores. A job is only classified as a Golden Match if it meets an uncompromising 80% threshold across technical skills, seniority level, and years of experience.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-wrap blue-glow">
              <ShieldCheck size={24} color="var(--blue)" />
            </div>
            <h3>Client-Side CMap Resume Engine</h3>
            <p>
              Decompresses binary PDF streams (`inflateRaw`), decodes LaTeX/Canva CID font vectors, and parses your skills right in your browser. Zero third-party cloud uploads.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-wrap purple-glow">
              <Clock size={24} color="#A855F7" />
            </div>
            <h3>Time-Adaptive Motivational Hub</h3>
            <p>
              Whether you are applying at 12:30 AM ("Welcome back, nightowlers!") or greeting the dawn, RoleRadar greets you with personalized motivational energy tailored to the hour.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-wrap green-glow">
              <Layers3 size={24} color="#10B981" />
            </div>
            <h3>High-Contrast Multi-Axis Filters</h3>
            <p>
              Custom themed dropdowns for Department, Experience (Years), Seniority, Work Mode, and Markets. Built to look crisp and clean in both dark and light modes.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-wrap orange-glow">
              <FileText size={24} color="#F97316" />
            </div>
            <h3>Continuous GitOps Ingestion</h3>
            <p>
              Drop Excel sheets into `data/` and push to GitHub. GitHub Actions automatically extracts, normalizes, deduplicates, and re-deploys your live site in 45 seconds.
            </p>
          </div>

          <div className="landing-feature-card">
            <div className="feature-icon-wrap cyan-glow">
              <Lock size={24} color="#06B6D4" />
            </div>
            <h3>Private Local Kanban & Bookmarks</h3>
            <p>
              Track applications from Saved ➔ Applied ➔ Interviewing ➔ Offered in IndexedDB. Export full JSON backups anytime from Settings. Your data stays yours.
            </p>
          </div>
        </div>
      </section>

      {/* The Vibe-Coded AI Pair-Programming Story */}
      <section className="landing-vibe-section" id="vibe-coded">
        <div className="landing-vibe-container">
          <div className="vibe-header">
            <span className="vibe-pill">💫 100% VIBE-CODED PROJECT</span>
            <h2>Crafted Through Real-Time AI Pair Programming</h2>
            <p>
              RoleRadar wasn't built by a slow corporate committee. It is a <strong>fully vibe-coded application</strong> engineered through conversational pair-programming with top-tier AI companions:
            </p>
          </div>

          <div className="vibe-cards-grid">
            <div className="vibe-card">
              <div className="vibe-logo">🤖</div>
              <h4>ChatGPT</h4>
              <p>Architectural brainstorming, dataset schema normalization, and rapid prototyping of the Excel ingestion pipeline.</p>
            </div>

            <div className="vibe-card">
              <div className="vibe-logo">🎨</div>
              <h4>Claude</h4>
              <p>UI aesthetic harmony, component modularity, styling typography, and responsive dashboard design.</p>
            </div>

            <div className="vibe-card vibe-card-highlight">
              <div className="vibe-logo">✨</div>
              <h4>Google Antigravity</h4>
              <span className="vibe-role-badge">The Saviour & Companion</span>
              <p>
                Solved in-browser CMap hex font decoding, built pure JS DEFLATE decompression, calibrated strict 80% match standards, fixed dark-mode dropdowns, and automated continuous GitOps deployment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="landing-faq" id="faq">
        <div className="landing-section-header">
          <span className="section-badge">GOT QUESTIONS?</span>
          <h2>Frequently Asked Questions</h2>
          <p>Everything you need to know about RoleRadar.</p>
        </div>

        <div className="landing-faq-accordion">
          {faqs.map((faq, idx) => (
            <div
              key={faq.q}
              className={`faq-item ${openFaq === idx ? "open" : ""}`}
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <div className="faq-question">
                <span>{faq.q}</span>
                <ChevronDown size={18} className={`faq-chevron ${openFaq === idx ? "rotate-180" : ""}`} />
              </div>
              {openFaq === idx && <div className="faq-answer">{faq.a}</div>}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="landing-bottom-cta">
        <div className="landing-bottom-cta-box">
          <Sparkles size={28} color="#F5B700" style={{ margin: "0 auto 12px" }} />
          <h2>Ready to Launch Your Career Radar?</h2>
          <p>Jump right into the workspace, search 6,675+ active opportunities, or upload your resume for instant matching.</p>
          <div className="bottom-cta-buttons">
            <button
              className="landing-launch-btn-large"
              onClick={() => navigate("/dashboard")}
            >
              <span>Launch RoleRadar Workspace</span>
              <ArrowRight size={18} />
            </button>
            <button
              className="landing-secondary-btn-large"
              onClick={() => navigate("/jobs")}
            >
              <span>Explore All Jobs</span>
            </button>
          </div>
        </div>
      </section>

      {/* Landing Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-left">
            <div className="landing-brand">
              <div className="landing-brand-mark"><BriefcaseBusiness size={18} /></div>
              <span className="brand-title">RoleRadar</span>
            </div>
            <p>A personal, high-performance career workspace hosted on GitHub Pages.</p>
          </div>

          <div className="footer-links">
            <button onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button onClick={() => navigate("/jobs")}>Explore Jobs</button>
            <button onClick={() => navigate("/freshers")}>Fresher Roles</button>
            <button onClick={() => navigate("/profile")}>Profile & Resume</button>
            <button onClick={() => navigate("/settings")}>Settings</button>
          </div>

          <div className="footer-bottom">
            <span>© 2026 RoleRadar · Open Source MIT License</span>
            <span>100% Client-Side Privacy Guaranteed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

