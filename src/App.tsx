import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, ArrowDownUp, ArrowUpRight, BriefcaseBusiness, Building2, ChartNoAxesCombined,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Command, Database, Download,
  FileSpreadsheet, Filter, GraduationCap, LayoutDashboard, ListFilter, Menu, Moon, MoreHorizontal,
  Search, Settings, ShieldCheck, SlidersHorizontal, Sun, X, Bookmark, BookmarkCheck, ClipboardList,
  Layers3, MapPin, Clock3, ExternalLink, Sparkles, TrendingUp, Users, Wifi, Laptop, RefreshCw,
  UserCheck, User, Upload, Copy, CheckCheck, FileText, Award, Home
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Fuse from "fuse.js";
import type { Application, ApplicationStatus, Job, Metadata, UserProfile, JobMatchResult } from "./types/job";
import {
  getApplications, getBookmarks, saveApplication, saveBookmarks,
  exportLocalData, importLocalData, deleteApplication,
  getUserProfile, saveUserProfile
} from "./db/local";
import { compactNumber, prettyDate, initials } from "./utils/format";
import {
  calculateJobMatch, extractSkillsFromText, detectExperienceFromText, detectNameFromText,
  detectTitleFromText, extractTextFromFile, generatePersonalizedPitch, isFresherJob, parseExperienceYears
} from "./utils/matcher";
import { LandingPage } from "./LandingPage";

const nav = [
  { label: "Workspace", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/jobs", label: "Explore Jobs", icon: Search },
    { to: "/freshers", label: "Fresher Jobs", icon: GraduationCap },
    { to: "/departments", label: "Departments", icon: Layers3 }
  ]},
  { label: "My space", items: [
    { to: "/profile", label: "My Profile & Resume", icon: UserCheck },
    { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
    { to: "/applications", label: "Applications", icon: ClipboardList }
  ]},
  { label: "Insights", items: [
    { to: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
    { to: "/sources", label: "Data Sources", icon: FileSpreadsheet }
  ]},
  { label: "RoleRadar", items: [
    { to: "/", label: "Landing Home", icon: Home }
  ]}
];

const statuses: ApplicationStatus[] = ["interested","saved","applied","assessment","interview","offer","rejected"];
const statusLabel: Record<ApplicationStatus,string> = {
  interested:"Interested", saved:"Saved", applied:"Applied", assessment:"Assessment",
  interview:"Interview", offer:"Offer", rejected:"Rejected"
};

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  title: "",
  experienceYears: 0,
  skills: [],
  targetDepartment: "All departments",
  preferredWorkMode: "Any"
};

export default function App() {
  const [jobs,setJobs] = useState<Job[]>([]);
  const [meta,setMeta] = useState<Metadata | null>(null);
  const [bookmarks,setBookmarksState] = useState<string[]>([]);
  const [applications,setApplications] = useState<Application[]>([]);
  const [profile,setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [theme,setTheme] = useState<"light"|"dark">((localStorage.getItem("roleradar-theme") as "light"|"dark") || (localStorage.getItem("ji-theme") as "light"|"dark") || "light");
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [globalSearch,setGlobalSearch] = useState("");
  const [selectedJob,setSelectedJob] = useState<Job|null>(null);
  const [loading,setLoading] = useState(true);
  const [showOnboarding,setShowOnboarding] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("roleradar-theme",theme);
  },[theme]);

  // First-time onboarding trigger check (triggered when entering workspace)
  useEffect(() => {
    const onboarded = localStorage.getItem("roleradar-onboarded");
    if (!onboarded && location.pathname !== "/") {
      setShowOnboarding(true);
    }
  }, [location.pathname]);

  // Global search keyboard shortcut (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}generated/jobs.json`).then(r => { if(!r.ok) throw new Error("Could not load jobs.json"); return r.json(); }),
      fetch(`${import.meta.env.BASE_URL}generated/metadata.json`).then(r => r.json()),
      getBookmarks(), getApplications(), getUserProfile()
    ]).then(([j,m,b,a,p]) => {
      setJobs(j as Job[]);
      setMeta(m as Metadata);
      setBookmarksState(b);
      setApplications(a);
      if (p) setProfile(p);
    }).catch(err => console.error(err)).finally(()=>setLoading(false));
  },[]);

  // Precalculate resume/profile matches for all jobs
  const jobMatches = useMemo(() => {
    const map = new Map<string, JobMatchResult>();
    for (const j of jobs) {
      map.set(j.id, calculateJobMatch(j, profile));
    }
    return map;
  }, [jobs, profile]);

  const goldMatchesCount = useMemo(() => {
    let count = 0;
    jobMatches.forEach(m => { if (m.tier === "gold") count++; });
    return count;
  }, [jobMatches]);

  const greenMatchesCount = useMemo(() => {
    let count = 0;
    jobMatches.forEach(m => { if (m.tier === "green") count++; });
    return count;
  }, [jobMatches]);

  const fuse = useMemo(()=>new Fuse(jobs,{keys:["title","company","department","skills","location","experience","seniorityTag","level","searchText"],threshold:0.34,ignoreLocation:true}),[jobs]);
  
  const toggleBookmark = async (id:string) => {
    const next = bookmarks.includes(id) ? bookmarks.filter(x=>x!==id) : [...bookmarks,id];
    setBookmarksState(next); await saveBookmarks(next);
  };
  
  const upsertApplication = async (jobId:string,status:ApplicationStatus) => {
    const current = applications.find(a=>a.jobId===jobId);
    const now = new Date().toISOString();
    const appliedDate = status === "applied" ? (current?.appliedDate || now.slice(0,10)) : (current?.appliedDate || null);
    const next: Application = current ? {...current,status,appliedDate,updatedAt:now} : {
      id: crypto.randomUUID(),jobId,status,appliedDate,
      followUpDate:null,notes:"",createdAt:now,updatedAt:now
    };
    await saveApplication(next);
    setApplications(await getApplications());
  };
  
  const patchApplication = async (a:Application) => { await saveApplication({...a,updatedAt:new Date().toISOString()}); setApplications(await getApplications()); };
  const removeApplication = async (id:string) => { await deleteApplication(id); setApplications(await getApplications()); };
  
  const handleSaveProfile = async (newProfile: UserProfile) => {
    setProfile(newProfile);
    await saveUserProfile(newProfile);
  };

  const exportData = async () => {
    const data = await exportLocalData();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download="roleradar-backup.json"; a.click(); URL.revokeObjectURL(url);
  };
  
  const importData = async (file:File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || typeof data !== "object") throw new Error("Invalid backup format");
      await importLocalData(data);
      setBookmarksState(await getBookmarks());
      setApplications(await getApplications());
      if (data.profile) setProfile(data.profile);
      alert("RoleRadar backup restored successfully!");
    } catch(err) {
      console.error(err);
      alert("Failed to restore backup: Please select a valid RoleRadar JSON backup file.");
    }
  };

  const searchJobs = (query:string) => query.trim() ? fuse.search(query).map(x=>x.item) : jobs;

  // Fully Clickable Dynamic Breadcrumbs
  const renderBreadcrumbs = () => {
    const pathname = location.pathname;
    const searchParams = new URLSearchParams(location.search || window.location.hash.split("?")[1] || "");
    const dept = searchParams.get("department");
    const skill = searchParams.get("skill");
    const posted = searchParams.get("posted");
    const matchFilter = searchParams.get("match");

    const crumbs: ReactNode[] = [
      <button key="workspace" className="breadcrumb-link" onClick={()=>navigate("/dashboard")}>
        Workspace
      </button>
    ];

    if (pathname === "/" || pathname === "/dashboard") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Dashboard</strong>);
    } else if (pathname === "/jobs") {
      if (dept || skill || posted || matchFilter) {
        crumbs.push(<ChevronRight key="sep1" size={14} />);
        crumbs.push(
          <button key="jobs" className="breadcrumb-link" onClick={()=>navigate("/jobs")}>
            Explore Jobs
          </button>
        );
        crumbs.push(<ChevronRight key="sep2" size={14} />);
        const detail = dept ? `Dept: ${dept}` : skill ? `Skill: ${skill}` : posted ? `Posted: ${prettyDate(posted)}` : matchFilter === "gold" ? "Golden Opportunities (≥ 80%)" : "Resume Matches";
        crumbs.push(<strong key="filter">{detail}</strong>);
      } else {
        crumbs.push(<ChevronRight key="sep1" size={14} />);
        crumbs.push(<strong key="page">Explore Jobs</strong>);
      }
    } else if (pathname === "/freshers") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Fresher Jobs</strong>);
    } else if (pathname === "/departments") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Departments</strong>);
    } else if (pathname === "/profile") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">My Profile & Resume</strong>);
    } else if (pathname === "/bookmarks") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Bookmarks</strong>);
    } else if (pathname === "/applications") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Applications</strong>);
    } else if (pathname === "/analytics") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Analytics</strong>);
    } else if (pathname === "/sources") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Data Sources</strong>);
    } else if (pathname === "/settings") {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Settings</strong>);
    } else {
      crumbs.push(<ChevronRight key="sep1" size={14} />);
      crumbs.push(<strong key="page">Dashboard</strong>);
    }

    return <div className="breadcrumbs">{crumbs}</div>;
  };

  // Standalone Full-Width Landing Page on root route "/"
  if (location.pathname === "/") {
    return (
      <>
        <LandingPage
          jobs={jobs}
          meta={meta}
          profile={profile}
          goldCount={goldMatchesCount}
          theme={theme}
          setTheme={setTheme}
          onOpenJob={setSelectedJob}
        />
        {selectedJob && (
          <JobModal
            job={selectedJob}
            bookmarked={bookmarks.includes(selectedJob.id)}
            currentStatus={applications.find(a => a.jobId === selectedJob.id)?.status}
            match={jobMatches.get(selectedJob.id)}
            profile={profile}
            onClose={() => setSelectedJob(null)}
            onBookmark={() => toggleBookmark(selectedJob.id)}
            onTrack={upsertApplication}
          />
        )}
      </>
    );
  }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen?"sidebar-open":""}`}>
      <div className="brand" onClick={()=>navigate("/")} style={{cursor:"pointer"}} title="Back to Landing Page">
        <div className="brand-mark"><BriefcaseBusiness size={20}/></div>
        <div><div className="brand-name">RoleRadar</div><div className="brand-sub">Career workspace ↗</div></div>
        <button className="icon-button mobile-close" onClick={(e)=>{e.stopPropagation();setSidebarOpen(false);}}><X size={18}/></button>
      </div>
      <div className="workspace-switch" onClick={()=>navigate("/profile")} style={{cursor:"pointer"}} title="Edit workspace profile">
        <div className="workspace-avatar">{initials(profile.name || "RR")}</div>
        <div className="workspace-copy">
          <strong>{profile.name}</strong>
          <span>{profile.title || "Career Profile"}</span>
        </div>
        <ChevronRight size={15}/>
      </div>
      <nav className="side-nav">
        {nav.map(group=><div className="nav-group" key={group.label}>
          <div className="nav-label">{group.label}</div>
          {group.items.map(item=><NavLink end={item.to==="/" || item.to==="/dashboard"} to={item.to} key={item.to} onClick={()=>setSidebarOpen(false)} className={({isActive})=>`nav-item ${isActive?"active":""}`}>
            <item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span>
            {item.to==="/profile" && goldMatchesCount > 0 && <em style={{background:"var(--amber)",color:"#121A33"}}>{goldMatchesCount}★</em>}
            {item.to==="/bookmarks" && bookmarks.length>0 && <em>{bookmarks.length}</em>}
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="data-status"><span className="status-dot"/><div><strong>Data synced</strong><small>{meta?.uniqueJobs ? `${compactNumber(meta.uniqueJobs)} jobs indexed` : "Loading dataset"}</small></div><RefreshCw size={14}/></div>
        <NavLink to="/settings" className="nav-item settings-link"><Settings size={18}/><span>Settings</span></NavLink>
        <div className="profile" onClick={()=>navigate("/profile")} style={{cursor:"pointer"}} title="Manage Profile & Resume">
          <div className="profile-avatar">{initials(profile.name || "RR")}</div>
          <div><strong>{profile.name}</strong><small>{profile.skills.length} skills · {goldMatchesCount} gold matches</small></div>
          <ChevronRight size={16}/>
        </div>
      </div>
    </aside>

    {sidebarOpen && <button className="sidebar-backdrop" onClick={()=>setSidebarOpen(false)} aria-label="Close navigation"/>}
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-left">
          <button className="icon-button menu-trigger" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button>
          {renderBreadcrumbs()}
        </div>
        <div className="topbar-actions">
          <label className="global-search">
            <Search size={16}/>
            <input
              ref={searchInputRef}
              value={globalSearch}
              onChange={e=>setGlobalSearch(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){navigate("/jobs");}}}
              placeholder="Search jobs, skills, companies..."
            />
            <kbd>⌘ K</kbd>
          </label>
          <button className="icon-button theme-toggle" title="Toggle theme" onClick={()=>setTheme(theme==="light"?"dark":"light")}>{theme==="light"?<Moon size={18}/>:<Sun size={18}/>}</button>
          <button className="top-avatar" onClick={()=>navigate("/profile")} title="Open Profile">
            {initials(profile.name || "RR")}
          </button>
        </div>
      </header>

      <div className="page-content">
        {loading ? <div className="loading-state"><div className="loader"/><strong>Preparing your workspace</strong><span>Loading your RoleRadar dataset...</span></div> :
        <Routes>
          <Route path="/" element={<Dashboard jobs={jobs} meta={meta} applications={applications} profile={profile} goldCount={goldMatchesCount} onOpen={setSelectedJob}/>}/>
          <Route path="/dashboard" element={<Dashboard jobs={jobs} meta={meta} applications={applications} profile={profile} goldCount={goldMatchesCount} onOpen={setSelectedJob}/>}/>
          <Route path="/jobs" element={<JobsPage jobs={searchJobs(globalSearch)} allJobs={jobs} onOpen={setSelectedJob} bookmarks={bookmarks} onBookmark={toggleBookmark} jobMatches={jobMatches} profile={profile}/>}/>
          <Route path="/freshers" element={<JobsPage jobs={searchJobs(globalSearch).filter(isFresherJob)} allJobs={jobs} onOpen={setSelectedJob} bookmarks={bookmarks} onBookmark={toggleBookmark} fresher jobMatches={jobMatches} profile={profile}/>}/>
          <Route path="/departments" element={<Departments jobs={jobs}/>}/>
          <Route path="/profile" element={<ProfilePage profile={profile} onSave={handleSaveProfile} jobs={jobs} goldCount={goldMatchesCount} greenCount={greenMatchesCount}/>}/>
          <Route path="/bookmarks" element={<JobsPage jobs={jobs.filter(j=>bookmarks.includes(j.id))} allJobs={jobs} onOpen={setSelectedJob} bookmarks={bookmarks} onBookmark={toggleBookmark} title="Your bookmarks" jobMatches={jobMatches} profile={profile}/>}/>
          <Route path="/applications" element={<ApplicationsPage jobs={jobs} applications={applications} onStatus={upsertApplication} onRemove={removeApplication} onPatch={patchApplication}/>}/>
          <Route path="/analytics" element={<Analytics jobs={jobs} meta={meta}/>}/>
          <Route path="/sources" element={<Sources meta={meta}/>}/>
          <Route path="/settings" element={<SettingsPage theme={theme} setTheme={setTheme} onExport={exportData} onImport={importData}/>}/>
          <Route path="*" element={<Dashboard jobs={jobs} meta={meta} applications={applications} profile={profile} goldCount={goldMatchesCount} onOpen={setSelectedJob}/>}/>
        </Routes>}
      </div>
      <footer className="footer"><span>RoleRadar <span className="footer-dot">·</span> Built for your next move</span><span>Bookmarks & Profile stay private in your browser</span></footer>
    </main>
    
    {/* Job Details Modal */}
    {selectedJob && <JobModal job={selectedJob} bookmarked={bookmarks.includes(selectedJob.id)} currentStatus={applications.find(a=>a.jobId===selectedJob.id)?.status} match={jobMatches.get(selectedJob.id)} profile={profile} onClose={()=>setSelectedJob(null)} onBookmark={()=>toggleBookmark(selectedJob.id)} onTrack={upsertApplication}/>}
    
    {/* First-time Onboarding Modal */}
    {showOnboarding && <OnboardingModal profile={profile} onSave={handleSaveProfile} onClose={()=>setShowOnboarding(false)} jobs={jobs}/>}
  </div>;
}

function OnboardingModal({
  profile,
  onSave,
  onClose,
  jobs
}: {
  profile: UserProfile;
  onSave: (p: UserProfile) => void;
  onClose: () => void;
  jobs: Job[];
}) {
  const navigate = useNavigate();
  const [name, setName] = useState(profile.name || "");
  const [title, setTitle] = useState(profile.title || "");
  const [exp, setExp] = useState(profile.experienceYears ? String(profile.experienceYears) : "0");
  const [skills, setSkills] = useState<string[]>(profile.skills || []);
  const [newSkill, setNewSkill] = useState("");
  const [resumeFileName, setResumeFileName] = useState(profile.resumeFileName || "");
  const [resumeText, setResumeText] = useState(profile.resumeText || "");
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allKnownSkills = useMemo(() => {
    return Array.from(new Set(jobs.flatMap(j => j.skills))).filter(Boolean);
  }, [jobs]);

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim();
    if (!trimmed) return;
    if (!skills.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkills(prev => [...prev, trimmed]);
    }
    setNewSkill("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(prev => prev.filter(s => s.toLowerCase() !== skillToRemove.toLowerCase()));
  };

  const handleFileUpload = async (file: File) => {
    setAnalyzing(true);
    setResumeFileName(file.name);
    try {
      const extractedText = await extractTextFromFile(file);
      setResumeText(extractedText);
      
      const detectedSkills = extractSkillsFromText(extractedText, allKnownSkills);
      const detectedExp = detectExperienceFromText(extractedText);
      const detectedName = detectNameFromText(extractedText);
      const detectedTitle = detectTitleFromText(extractedText);
      
      if (detectedSkills.length > 0) {
        setSkills(prev => Array.from(new Set([...prev, ...detectedSkills])));
      }
      if (detectedExp !== null) {
        setExp(String(detectedExp));
      }
      if (detectedName && !name.trim()) {
        setName(detectedName);
      }
      if (detectedTitle && !title.trim()) {
        setTitle(detectedTitle);
      }
      setUploadMessage(`✓ Detected ${detectedSkills.length} skills & ${detectedExp ?? exp} yrs experience from ${file.name}!`);
    } catch (e) {
      console.error(e);
      setUploadMessage("Could not parse file automatically. You can type or paste skills below.");
    } finally {
      setAnalyzing(false);
    }
  };

  // Enabled only when details, skills, or resume are provided
  const isSearchEnabled = skills.length > 0 || Boolean(resumeFileName) || Boolean(resumeText.trim()) || (name.trim().length > 0 && title.trim().length > 0);

  const handleSearchJobs = () => {
    const updated: UserProfile = {
      ...profile,
      name: name.trim() || "Candidate",
      title: title.trim() || (skills[0] ? `${skills[0]} Specialist` : "Software Engineer"),
      experienceYears: Math.max(0, parseInt(exp, 10) || 0),
      skills,
      resumeFileName,
      resumeText,
      resumeUploadedAt: resumeFileName ? new Date().toISOString() : profile.resumeUploadedAt
    };
    onSave(updated);
    localStorage.setItem("roleradar-onboarded", "true");
    onClose();
    // Direct navigate to golden matches or all matches
    navigate("/jobs?match=gold");
  };

  const handleShowAllJobs = () => {
    if (name.trim() || skills.length > 0 || resumeFileName) {
      const updated: UserProfile = {
        ...profile,
        name: name.trim() || profile.name || "Candidate",
        title: title.trim() || profile.title || "Career Profile",
        experienceYears: Math.max(0, parseInt(exp, 10) || 0),
        skills: skills.length > 0 ? skills : profile.skills,
        resumeFileName,
        resumeText
      };
      onSave(updated);
    }
    localStorage.setItem("roleradar-onboarded", "true");
    onClose();
    navigate("/jobs");
  };

  const popularPills = ["React", "TypeScript", "Python", "SQL", "AWS", "Docker", "Java", "Node.js", "AI", "Git", "DevOps", "Next.js"];
  const expPills = [
    { label: "Fresher (0 yrs)", val: "0" },
    { label: "1 yr", val: "1" },
    { label: "2 yrs", val: "2" },
    { label: "3 yrs", val: "3" },
    { label: "4 yrs", val: "4" },
    { label: "5+ yrs", val: "5" },
    { label: "8+ yrs", val: "8" }
  ];

  return (
    <div className="onboarding-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) { localStorage.setItem("roleradar-onboarded", "true"); onClose(); } }}>
      <div className="onboarding-modal">
        <div className="onboarding-header">
          <div className="onboarding-title-wrap">
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
              <div className="brand-mark" style={{width:"28px",height:"28px",borderRadius:"8px",fontSize:"12px"}}>
                <BriefcaseBusiness size={16}/>
              </div>
              <span style={{fontSize:"13px",fontWeight:700,letterSpacing:"1px",color:"var(--blue)",textTransform:"uppercase"}}>Welcome to RoleRadar</span>
            </div>
            <h2>Let's personalize your career workspace</h2>
            <p>Tell us your background or upload your resume. RoleRadar will automatically scan all opportunities and spotlight your Golden Matches (≥ 80% fit).</p>
          </div>
          <button
            className="icon-button"
            onClick={() => { localStorage.setItem("roleradar-onboarded", "true"); onClose(); }}
            title="Close"
          >
            <X size={19}/>
          </button>
        </div>

        {/* Resume Quick Upload Section */}
        <div
          className="resume-uploader"
          style={{padding:"18px 16px",background:"var(--soft)",borderRadius:"12px"}}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.docx,.md"
            style={{display:"none"}}
            onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}
          />
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"10px"}}>
            <Upload size={22} color="var(--blue)"/>
            <div style={{textAlign:"left"}}>
              <strong style={{display:"block",fontSize:"13.5px",color:"var(--text)"}}>
                {analyzing ? "Extracting skills from resume..." : resumeFileName ? `Uploaded: ${resumeFileName}` : "Upload your resume (.pdf, .txt, .docx)"}
              </strong>
              <small style={{color:"var(--muted)",fontSize:"12px"}}>Auto-fills your skills & experience in 1 second · 100% private to your browser</small>
            </div>
          </div>
          {uploadMessage && (
            <div style={{marginTop:"8px",fontSize:"12px",color:"#10B981",fontWeight:600}}>
              {uploadMessage}
            </div>
          )}
        </div>

        {/* Manual Details Form */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
          <div className="form-field" style={{marginBottom:0}}>
            <label>Your Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alex Sharma"
            />
          </div>
          <div className="form-field" style={{marginBottom:0}}>
            <label>Target Role / Headline</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Frontend Engineer, Data Analyst"
            />
          </div>
        </div>

        {/* Experience Pills */}
        <div className="form-field" style={{marginBottom:0}}>
          <label>Years of Experience</label>
          <div className="exp-pills">
            {expPills.map(p => (
              <button
                key={p.val}
                type="button"
                className={`exp-pill ${exp === p.val ? "active" : ""}`}
                onClick={() => setExp(p.val)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Skills Tag Input & Suggestions */}
        <div className="form-field" style={{marginBottom:0}}>
          <label>Skills & Technologies ({skills.length})</label>
          <div className="skills-box" style={{minHeight:"42px",padding:"6px"}}>
            {skills.map(s => (
              <span key={s} className="skill-chip">
                {s}
                <button type="button" onClick={() => handleRemoveSkill(s)} title="Remove"><X size={12}/></button>
              </span>
            ))}
            {skills.length === 0 && (
              <span style={{fontSize:"12.5px",color:"var(--muted)",padding:"4px 6px"}}>Add your skills or tap suggestions below...</span>
            )}
          </div>
          <div style={{display:"flex",gap:"8px",marginTop:"7px"}}>
            <input
              style={{flex:1,padding:"7px 11px",fontSize:"13px"}}
              placeholder="Type a skill (e.g. React, Python) and press Enter..."
              value={newSkill}
              onChange={e => setNewSkill(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(newSkill); } }}
            />
            <button
              type="button"
              className="button button-secondary"
              style={{padding:"7px 12px",fontSize:"12.5px"}}
              onClick={() => handleAddSkill(newSkill)}
            >
              Add
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"5px",marginTop:"8px"}}>
            <small style={{color:"var(--muted)",fontSize:"11.5px"}}>Quick tap to add:</small>
            {popularPills.filter(s => !skills.some(x => x.toLowerCase() === s.toLowerCase())).slice(0, 8).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => handleAddSkill(s)}
                style={{border:"1px solid var(--line)",background:"var(--panel)",borderRadius:"6px",padding:"2px 7px",fontSize:"11.5px",color:"var(--muted)",cursor:"pointer"}}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="onboarding-actions" style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div style={{fontSize:"12px",color:isSearchEnabled ? "#10B981" : "var(--muted)",display:"flex",alignItems:"center",gap:"5px"}}>
            {isSearchEnabled ? (
              <span>✓ Ready to match against 6,675 live jobs!</span>
            ) : (
              <span>Add skills, details, or upload resume to enable search</span>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
            <button
              type="button"
              className="button button-secondary"
              onClick={handleShowAllJobs}
            >
              Show All Jobs
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!isSearchEnabled}
              onClick={handleSearchJobs}
              style={{
                boxShadow: isSearchEnabled ? "0 0 16px rgba(36, 71, 245, 0.45)" : "none",
                opacity: isSearchEnabled ? 1 : 0.4,
                cursor: isSearchEnabled ? "pointer" : "not-allowed"
              }}
            >
              <Sparkles size={16}/> Search Matching Jobs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function matchesExperience(job: Job, selectedExp: string): boolean {
  if (selectedExp === "All experience") return true;
  const years = parseExperienceYears(job.experience);
  
  if (selectedExp === "bracket:0-1") {
    return isFresherJob(job) || (years !== null && years <= 1) || (job.experience || "").includes("0+") || (job.experience || "").includes("1+");
  }
  if (selectedExp === "bracket:1-3") {
    return years !== null && years >= 1 && years <= 3;
  }
  if (selectedExp === "bracket:3-5") {
    return years !== null && years >= 3 && years <= 5;
  }
  if (selectedExp === "bracket:5-8") {
    return years !== null && years >= 5 && years <= 8;
  }
  if (selectedExp === "bracket:8+") {
    return years !== null && years >= 8;
  }
  
  if (job.experience && job.experience.toLowerCase().trim() === selectedExp.toLowerCase().trim()) return true;
  const targetYears = parseExperienceYears(selectedExp);
  if (targetYears !== null && years === targetYears) return true;

  return false;
}

function matchesLevel(job: Job, selectedLevel: string): boolean {
  if (selectedLevel === "All levels") return true;
  const levelStr = (job.level || "").toLowerCase();
  const seniorityStr = (job.seniorityTag || "").toLowerCase();
  
  if (selectedLevel === "Fresher / Entry") {
    return isFresherJob(job) || seniorityStr.includes("intern") || seniorityStr.includes("junior");
  }
  if (selectedLevel === "Junior") {
    return seniorityStr.includes("junior") || seniorityStr.includes("intern") || levelStr.includes("junior");
  }
  if (selectedLevel === "Middle") {
    return seniorityStr.includes("middle") || seniorityStr.includes("mid");
  }
  if (selectedLevel === "Senior") {
    return seniorityStr.includes("senior") || levelStr === "senior";
  }
  if (selectedLevel === "Lead / Principal") {
    return /lead|staff|principal|chief|director|manager|c level/.test(`${seniorityStr} ${levelStr}`);
  }
  if (selectedLevel === "Junior / Fresher") {
    return job.level === "Junior / Fresher";
  }
  return job.level === selectedLevel || job.seniorityTag === selectedLevel;
}

function SectionHeading({eyebrow,title,description,action}:{eyebrow?:string,title:string,description?:string,action?:ReactNode}) {
  return <div className="section-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow===eyebrow.toUpperCase()?eyebrow[0]+eyebrow.slice(1).toLowerCase():eyebrow}</div>}<h1>{title}</h1>{description&&<p>{description}</p>}</div>{action}</div>;
}

function StatCard({label,value,change,icon:Icon,tint="blue"}:{label:string,value:string,change:string,icon:any,tint?:string}) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tint}`}><Icon size={18}/></div></div><div className="stat-value">{value}</div><div className="stat-foot"><span className="stat-trend"><TrendingUp size={13}/>{change}</span><span>in your dataset</span></div></div>;
}

function getMotivationalGreeting(): { greeting: string; description: string } {
  const h = new Date().getHours();
  // Late Night / Midnight (00:00 - 04:59) - e.g. 12:30 AM
  if (h >= 0 && h < 5) {
    return {
      greeting: "Welcome back, nightowlers!",
      description: "Quiet hours, big ambitions. Great opportunities are built while the world is sleeping."
    };
  }
  if (h >= 5 && h < 9) {
    return {
      greeting: "Rise and conquer, early bird!",
      description: "The morning belongs to the relentless. Your dream role is waiting for you."
    };
  }
  if (h >= 9 && h < 12) {
    return {
      greeting: "Peak focus mode activated!",
      description: "You're one bold application away from changing your entire career trajectory."
    };
  }
  if (h >= 12 && h < 17) {
    return {
      greeting: "Powering through the day!",
      description: "Keep that momentum soaring! Every connection and bookmark brings you closer to your goal."
    };
  }
  if (h >= 17 && h < 21) {
    return {
      greeting: "Evening hustle, achiever!",
      description: "Turning today's dedicated work into tomorrow's interview offers. Finish today strong."
    };
  }
  return {
    greeting: "Burning the midnight oil!",
    description: "Unwavering commitment in the late hours is what sets true champions apart."
  };
}

function Dashboard({jobs,meta,applications,profile,goldCount,onOpen}:{jobs:Job[],meta:Metadata|null,applications:Application[],profile:UserProfile,goldCount:number,onOpen:(j:Job)=>void}) {
  const navigate = useNavigate();
  const fresh = [...jobs].sort((a,b)=>(b.postedOn||"").localeCompare(a.postedOn||"")).slice(0,6);
  const deptData = Object.entries(jobs.reduce((a,j)=>{const k=j.department||"Other";a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]).slice(0,7).map(([name,jobs])=>({name,jobs}));
  const modeData = Object.entries(jobs.reduce((a,j)=>{const k=j.workMode||"Not specified";a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)).map(([name,value])=>({name,value}));
  const fresher = jobs.filter(isFresherJob).length;
  const dayCounts = jobs.reduce((a,j)=>{if(j.postedOn)a[j.postedOn]=(a[j.postedOn]||0)+1;return a;},{} as Record<string,number>);
  const days = Object.keys(dayCounts).sort().slice(-14).map(d=>({day:d,label:d.slice(5),jobs:dayCounts[d]}));
  const latest = [...days].sort((a,b)=>b.jobs-a.jobs)[0]?.day;
  const { greeting, description: greetingDesc } = getMotivationalGreeting();

  return <div className="page-stack">
    <SectionHeading
      eyebrow={new Intl.DateTimeFormat("en-IN", { weekday:"long", month:"long", day:"2-digit", year:"numeric" }).format(new Date())}
      title={`${greeting} Here's what's new.`}
      description={greetingDesc}
      action={<button className="button button-secondary" onClick={()=>navigate("/sources")}><Database size={16}/> View data sources</button>}
    />

    {/* Golden Opportunity Spotlight Banner */}
    {goldCount > 0 && (
      <div className="welcome-strip" style={{borderColor:"#F5B700",background:"linear-gradient(100deg,rgba(245,183,0,0.12),rgba(245,183,0,0.04) 65%,var(--panel))"}}>
        <div className="welcome-icon" style={{background:"#F5B700",color:"#121A33"}}>
          <Sparkles size={20}/>
        </div>
        <div>
          <strong style={{color:"var(--text)"}}>
            {goldCount} Golden Opportunities (≥ 80% fit) match your resume!
          </strong>
          <span>
            Matched for {profile.name} ({profile.skills.slice(0, 4).join(", ")}) · {profile.experienceYears}+ years experience.
          </span>
        </div>
        <button className="button button-primary" onClick={()=>navigate("/jobs?match=gold")}>
          Explore Golden Matches <ArrowUpRight size={15}/>
        </button>
      </div>
    )}

    <div className="stats-grid">
      <StatCard label="Total opportunities" value={compactNumber(jobs.length)} change="All sources" icon={BriefcaseBusiness}/>
      <StatCard label="Golden Matches (≥ 80%)" value={String(goldCount)} change="High resume fit" icon={Sparkles} tint="orange"/>
      <StatCard label="Junior / fresher" value={compactNumber(fresher)} change="Entry-level signals" icon={GraduationCap} tint="green"/>
      <StatCard label="Remote opportunities" value={compactNumber(jobs.filter(j=>(j.workMode||"").toLowerCase().includes("remote")).length)} change="Remote tagged" icon={Wifi} tint="violet"/>
    </div>

    <section className="panel chart-panel">
      <div className="panel-heading"><div><h2>Posted per day</h2><p>Click a day to see only that day's jobs</p></div></div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{left:0,right:8,top:8,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)"/>
            <XAxis dataKey="label" tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false}/>
            <YAxis width={40} tick={{fontSize:12,fill:"var(--muted)"}} axisLine={false} tickLine={false}/>
            <Tooltip cursor={{fill:"var(--hover)"}} contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:10,color:"var(--text)"}}/>
            <Bar dataKey="jobs" radius={[5,5,0,0]} cursor="pointer" onClick={(d:any)=>{navigate("/jobs?posted="+d.day);}}>
              {days.map(d=><Cell key={d.day} fill={d.day===latest?"#F5B700":"#2447F5"}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>

    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><h2>Jobs by department</h2><p>Where opportunities are concentrated</p></div><button className="text-button" onClick={()=>navigate("/departments")}>Explore all <ArrowUpRight size={14}/></button></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={deptData} layout="vertical" margin={{left:10,right:18,top:4,bottom:4}}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line)"/><XAxis type="number" hide/><YAxis type="category" dataKey="name" width={128} tick={{fontSize:11,fill:"var(--muted)"}} axisLine={false} tickLine={false}/><Tooltip cursor={{fill:"var(--hover)"}} contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12,color:"var(--text)"}}/><Bar dataKey="jobs" fill="#5b7cfa" radius={[0,5,5,0]} barSize={15}/></BarChart></ResponsiveContainer></div>
      </section>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><h2>Work arrangement</h2><p>How employers structure work</p></div></div>
        <div className="donut-layout">
          <div className="donut-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={modeData} dataKey="value" nameKey="name" innerRadius={57} outerRadius={82} paddingAngle={3} stroke="none">
                  {modeData.map((_,i)=><Cell key={i} fill={["#5b7cfa","#35b78a","#f4a64d","#a3a9b8"][i%4]}/>)}
                </Pie>
                <Tooltip contentStyle={{background:"var(--panel)",border:"1px solid var(--line)",borderRadius:12}}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center"><strong>{compactNumber(jobs.length)}</strong><span>total jobs</span></div>
          </div>
          <div className="legend">
            {modeData.map((m,i)=><div className="legend-item" key={m.name}><span className="legend-dot" style={{background:["#5b7cfa","#35b78a","#f4a64d","#a3a9b8"][i%4]}}/><span>{m.name}</span><strong>{compactNumber(m.value)}</strong></div>)}
          </div>
        </div>
      </section>
    </div>

    <section className="panel"><div className="panel-heading"><div><h2>Recently added opportunities</h2><p>The latest roles found across your workbooks</p></div><button className="text-button" onClick={()=>navigate("/jobs")}>View all jobs <ArrowUpRight size={14}/></button></div><JobList jobs={fresh} onOpen={onOpen}/></section>

    <div className="bottom-grid">
      <div className="panel insight-card"><div className="insight-symbol"><ShieldCheck size={20}/></div><div><h3>One dataset. Every opportunity.</h3><p>Your {meta?.workbooksProcessed||1} processed workbook is consolidated into {compactNumber(jobs.length)} unique job records. Add more Excel files to GitHub and the dashboard updates on deployment.</p><button className="text-button" onClick={()=>navigate("/sources")}>Review ingestion report <ArrowUpRight size={14}/></button></div></div>
      <div className="panel mini-stat"><div className="mini-stat-head"><span>My application activity</span><ClipboardList size={18}/></div><strong>{applications.length}</strong><span>tracked opportunities</span><button className="text-button" onClick={()=>navigate("/applications")}>Open tracker <ArrowUpRight size={14}/></button></div>
    </div>
  </div>;
}

function JobList({jobs,onOpen}:{jobs:Job[],onOpen:(j:Job)=>void}) {
  return <div className="job-list">{jobs.map(j=><button className="job-row" key={j.id} onClick={()=>onOpen(j)}><div className="company-logo">{initials(j.company || "?")}</div><div className="job-row-main"><strong>{j.title}</strong><span>{j.company} <i>·</i> {j.department||"Other"}</span></div><div className="job-row-meta"><span><MapPin size={13}/>{j.location||"Location not listed"}</span><span><Clock3 size={13}/>{j.experience||"Experience not specified"}</span></div><span className="job-row-date">{prettyDate(j.postedOn)}</span><ChevronRight size={16} className="row-chevron"/></button>)}</div>;
}

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownGroup {
  group: string;
  items: DropdownOption[];
}

type DropdownEntry = DropdownOption | DropdownGroup;

function FilterDropdown({
  icon: Icon,
  value,
  onChange,
  items,
  title
}: {
  icon: any;
  value: string;
  onChange: (val: string) => void;
  items: DropdownEntry[];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) {
      document.addEventListener("mousedown", handleOutside);
      document.addEventListener("keydown", handleEsc);
      return () => {
        document.removeEventListener("mousedown", handleOutside);
        document.removeEventListener("keydown", handleEsc);
      };
    }
  }, [open]);

  // Find active label
  const activeLabel = useMemo(() => {
    for (const item of items) {
      if ("group" in item) {
        const found = item.items.find(i => i.value === value);
        if (found) return found.label;
      } else {
        if (item.value === value) return item.label;
      }
    }
    return value;
  }, [items, value]);

  const isFiltered = value && !value.toLowerCase().startsWith("all") && value !== "recent";

  return (
    <div className="filter-dropdown-container" ref={containerRef}>
      <button
        type="button"
        className={`filter-dropdown-btn ${isFiltered ? "has-filter" : ""}`}
        onClick={() => setOpen(!open)}
        title={title}
        aria-expanded={open}
      >
        <Icon size={14} className="filter-icon" />
        <span className="filter-dropdown-label">{activeLabel}</span>
        <ChevronDown size={13} className={`chevron-icon ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="filter-dropdown-menu" role="listbox">
          {items.map((entry) => {
            if ("group" in entry) {
              return (
                <div key={entry.group} className="filter-dropdown-group">
                  <div className="filter-dropdown-group-title">{entry.group}</div>
                  {entry.items.map(subItem => (
                    <button
                      key={subItem.value}
                      type="button"
                      className={`filter-dropdown-item ${value === subItem.value ? "selected" : ""}`}
                      onClick={() => {
                        onChange(subItem.value);
                        setOpen(false);
                      }}
                      role="option"
                      aria-selected={value === subItem.value}
                    >
                      <span>{subItem.label}</span>
                      {value === subItem.value && <Check size={14} className="check-icon" />}
                    </button>
                  ))}
                </div>
              );
            }
            return (
              <button
                key={entry.value}
                type="button"
                className={`filter-dropdown-item ${value === entry.value ? "selected" : ""}`}
                onClick={() => {
                  onChange(entry.value);
                  setOpen(false);
                }}
                role="option"
                aria-selected={value === entry.value}
              >
                <span>{entry.label}</span>
                {value === entry.value && <Check size={14} className="check-icon" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function JobsPage({
  jobs,allJobs,onOpen,bookmarks,onBookmark,fresher,title,jobMatches,profile
}:{
  jobs:Job[],allJobs:Job[],onOpen:(j:Job)=>void,bookmarks:string[],
  onBookmark:(id:string)=>void,fresher?:boolean,title?:string,
  jobMatches:Map<string,JobMatchResult>,profile:UserProfile
}) {
  const [query,setQuery]=useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const filterInputRef = useRef<HTMLInputElement>(null);

  const searchParams = useMemo(() => new URLSearchParams(location.search || window.location.hash.split("?")[1] || ""), [location.search, location.hash]);
  const posted = searchParams.get("posted");
  const skill = searchParams.get("skill");
  const urlDept = searchParams.get("department");
  const urlMatch = searchParams.get("match");

  const [department,setDepartment]=useState(urlDept || "All departments");
  const [market,setMarket]=useState("All markets");
  const [mode,setMode]=useState("All work modes");
  const [level,setLevel]=useState(fresher ? "Fresher / Entry" : "All levels");
  const [experience,setExperience]=useState(fresher ? "bracket:0-1" : "All experience");
  const [matchFilter,setMatchFilter]=useState<"all"|"gold"|"matches">((urlMatch as any) || "all");
  const [sort,setSort]=useState("recent");
  const [page,setPage]=useState(1);
  const pageSize=12;

  useEffect(() => {
    if (urlDept) setDepartment(urlDept);
    if (urlMatch === "gold" || urlMatch === "matches") setMatchFilter(urlMatch);
  }, [urlDept, urlMatch]);

  // Press "/" to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        filterInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const dq = useDeferredValue(query);
  const departments = useMemo(()=>["All departments",...Array.from(new Set(allJobs.map(j=>j.department).filter(Boolean) as string[])).sort()], [allJobs]);

  const filtered = useMemo(()=>{
    let list = jobs;
    if (dq) {
      const f = new Fuse(list, { keys: ["title", "company", "department", "skills", "location", "experience", "seniorityTag", "level"], threshold: 0.35 });
      list = f.search(dq).map(x => x.item);
    }
    if (posted) list = list.filter(j => j.postedOn === posted);
    if (skill) {
      const sNorm = skill.toLowerCase().trim();
      list = list.filter(j => j.skills.some(sk => sk.toLowerCase().trim() === sNorm || sk.toLowerCase().includes(sNorm)));
    }
    if (market !== "All markets") list = list.filter(j => j.market === market);
    if (department !== "All departments") list = list.filter(j => j.department === department);
    if (mode !== "All work modes") list = list.filter(j => j.workMode === mode);
    
    // Apply Experience (Years) filter
    if (experience !== "All experience") {
      list = list.filter(j => matchesExperience(j, experience));
    }

    // Apply Level / Seniority filter
    if (level !== "All levels") {
      list = list.filter(j => matchesLevel(j, level));
    }

    // Apply Resume Match Filter
    if (matchFilter === "gold") {
      list = list.filter(j => jobMatches.get(j.id)?.tier === "gold");
    } else if (matchFilter === "matches") {
      list = list.filter(j => {
        const m = jobMatches.get(j.id);
        return m?.tier === "gold" || m?.tier === "green";
      });
    }

    return [...list].sort((a,b)=>{
      // When match filter is active, sort by highest match score
      if (matchFilter !== "all" && sort === "recent") {
        const scoreA = jobMatches.get(a.id)?.score ?? 0;
        const scoreB = jobMatches.get(b.id)?.score ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }
      if (sort === "recent") return (b.postedOn||"").localeCompare(a.postedOn||"");
      if (sort === "company") return a.company.localeCompare(b.company);
      if (sort === "exp-low") return (parseExperienceYears(a.experience) ?? 99) - (parseExperienceYears(b.experience) ?? 99);
      if (sort === "exp-high") return (parseExperienceYears(b.experience) ?? -1) - (parseExperienceYears(a.experience) ?? -1);
      return a.title.localeCompare(b.title);
    });
  },[jobs, dq, department, mode, level, experience, matchFilter, sort, posted, skill, market, jobMatches]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((page-1)*pageSize, page*pageSize);

  useEffect(()=>setPage(1),[query,department,mode,level,experience,matchFilter,sort,posted,skill,market]);

  const clearAllFilters = () => {
    setQuery("");
    setDepartment("All departments");
    setMode("All work modes");
    setLevel("All levels");
    setExperience("All experience");
    setMatchFilter("all");
    setMarket("All markets");
    navigate(location.pathname);
  };

  return <div className="page-stack">
    <SectionHeading
      eyebrow={fresher?"EARLY CAREER":"OPPORTUNITY EXPLORER"}
      title={title || (fresher?"Fresher opportunities":"Explore all jobs")}
      description={fresher?"Entry-level, junior and graduate opportunities with years filter tailored for freshers.":"Search and filter the complete combined job database with years and seniority filters."}
      action={<button className="button button-secondary" onClick={()=>downloadCsv(filtered)}><Download size={16}/> Export CSV</button>}
    />

    <div className="filter-panel">
      <div className="filter-search">
        <Search size={17}/>
        <input
          ref={filterInputRef}
          placeholder="Search job title, company, skill..."
          value={query}
          onChange={e=>setQuery(e.target.value)}
        />
        <kbd>/</kbd>
      </div>

      {/* Resume Match Filter Bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginTop:"12px",paddingBottom:"4px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <Sparkles size={16} color="var(--amber)"/>
          <strong style={{fontSize:"13px",color:"var(--text)"}}>Resume Match Filter:</strong>
        </div>
        <div className="match-tabs">
          <button
            className={`match-tab ${matchFilter==="all"?"active":""}`}
            onClick={()=>setMatchFilter("all")}
          >
            All Jobs
          </button>
          <button
            className={`match-tab gold-tab ${matchFilter==="gold"?"active":""}`}
            onClick={()=>setMatchFilter("gold")}
          >
            <Sparkles size={13} color="#F5B700"/> Golden (≥ 80%)
          </button>
          <button
            className={`match-tab green-tab ${matchFilter==="matches"?"active":""}`}
            onClick={()=>setMatchFilter("matches")}
          >
            <Check size={13} color="#10B981"/> All Matches (≥ 50%)
          </button>
        </div>
      </div>

      <div className="filter-controls">
        {/* Department Filter */}
        <FilterDropdown
          icon={ListFilter}
          value={department}
          onChange={setDepartment}
          items={departments.map(d => ({ value: d, label: d }))}
          title="Filter by Department"
        />

        {/* Experience (Years) Filter */}
        <FilterDropdown
          icon={Clock3}
          value={experience}
          onChange={setExperience}
          items={[
            { value: "All experience", label: "All experience (years)" },
            {
              group: "Years Brackets",
              items: [
                { value: "bracket:0-1", label: "0–1 yrs (Fresher / Intern)" },
                { value: "bracket:1-3", label: "1–3 yrs (Junior)" },
                { value: "bracket:3-5", label: "3–5 yrs (Mid-level)" },
                { value: "bracket:5-8", label: "5–8 yrs (Senior)" },
                { value: "bracket:8+", label: "8+ yrs (Lead / Principal)" },
              ]
            },
            {
              group: "Exact Years",
              items: [
                { value: "0+ yrs", label: "0+ yrs (Fresher)" },
                { value: "1+ yrs", label: "1+ yrs" },
                { value: "2+ yrs", label: "2+ yrs" },
                { value: "3+ yrs", label: "3+ yrs" },
                { value: "4+ yrs", label: "4+ yrs" },
                { value: "5+ yrs", label: "5+ yrs" },
                { value: "6+ yrs", label: "6+ yrs" },
                { value: "7+ yrs", label: "7+ yrs" },
                { value: "8+ yrs", label: "8+ yrs" },
                { value: "10+ yrs", label: "10+ yrs" },
                { value: "12+ yrs", label: "12+ yrs" },
                { value: "15+ yrs", label: "15+ yrs" },
              ]
            }
          ]}
          title="Filter by Years of Experience"
        />

        {/* Seniority / Level Filter */}
        <FilterDropdown
          icon={GraduationCap}
          value={level}
          onChange={setLevel}
          items={[
            { value: "All levels", label: "All levels (Seniority)" },
            { value: "Fresher / Entry", label: "Fresher / Entry Level" },
            { value: "Junior", label: "Junior" },
            { value: "Middle", label: "Mid-Level" },
            { value: "Senior", label: "Senior" },
            { value: "Lead / Principal", label: "Lead / Staff / Principal" },
            { value: "Junior / Fresher", label: "Junior / Fresher (Combined)" }
          ]}
          title="Filter by Seniority Level"
        />

        {/* Work Mode Filter */}
        <FilterDropdown
          icon={Wifi}
          value={mode}
          onChange={setMode}
          items={[
            { value: "All work modes", label: "All work modes" },
            ...Array.from(new Set(allJobs.map(j=>j.workMode).filter(Boolean) as string[])).sort().map(x=>({ value: x, label: x }))
          ]}
          title="Filter by Work Mode"
        />

        {/* Market Filter */}
        <FilterDropdown
          icon={MapPin}
          value={market}
          onChange={setMarket}
          items={[
            { value: "All markets", label: "All markets" },
            ...Array.from(new Set(allJobs.map(j=>j.market).filter(Boolean) as string[])).sort().map(x=>({ value: x, label: x }))
          ]}
          title="Filter by Market"
        />

        {/* Active chips from URL */}
        {(posted||skill)&&<button className="active-chip" title="Clear filter" onClick={()=>navigate(location.pathname)}>{posted?"Posted "+prettyDate(posted):"Skill: "+skill} <X size={13}/></button>}

        {/* Sort Options */}
        <FilterDropdown
          icon={ArrowDownUp}
          value={sort}
          onChange={setSort}
          items={[
            { value: "recent", label: "Most recent" },
            { value: "company", label: "Company A–Z" },
            { value: "title", label: "Job title A–Z" },
            { value: "exp-low", label: "Experience (Low to High)" },
            { value: "exp-high", label: "Experience (High to Low)" }
          ]}
          title="Sort listings"
        />
      </div>

      <div className="filter-summary">
        <span><strong>{compactNumber(filtered.length)}</strong> opportunities found</span>
        <button onClick={clearAllFilters}>Clear filters</button>
      </div>
    </div>

    <div className="panel jobs-table-panel">
      <div className="table-heading">
        <div>
          <h2>{fresher?"Early-career roles":"All opportunities"}</h2>
          <p>Showing {filtered.length?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,filtered.length)} of {compactNumber(filtered.length)} results</p>
        </div>
        <span className="table-source"><span className="status-dot"/> Combined dataset</span>
      </div>
      {shown.length===0?<div className="empty-state"><Search size={28}/><strong>No matching jobs found</strong><span>Try a different search or clear some filters.</span></div>:
      <div className="jobs-table-wrap">
        <table className="jobs-table">
          <thead>
            <tr>
              <th>POSITION</th>
              <th>EXPERIENCE / LEVEL</th>
              <th>LOCATION</th>
              <th>WORK MODE</th>
              <th>POSTED</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map(j=>{
              const match = jobMatches.get(j.id);
              const rowClass = match?.tier === "gold" ? "job-row-gold" : match?.tier === "green" ? "job-row-green" : "";
              return (
                <tr key={j.id} className={rowClass}>
                  <td>
                    <button className="table-job-title" onClick={()=>onOpen(j)}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                        <strong>{j.title}</strong>
                        {match?.tier === "gold" && (
                          <span className="badge-gold-glow" title={match.matchReason}>
                            <Sparkles size={11}/> Golden Match · {match.score}%
                          </span>
                        )}
                        {match?.tier === "green" && (
                          <span className="badge-green-glow" title={match.matchReason}>
                            <Check size={11}/> {match.score}% Match
                          </span>
                        )}
                      </div>
                      <span>{j.company} <i>·</i> {j.department||"Other"}</span>
                    </button>
                  </td>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                      <span>{j.experience||"—"}</span>
                      {j.seniorityTag && <span className={`pill ${j.seniorityTag.toLowerCase().includes("senior")?"pill-green":j.seniorityTag.toLowerCase().includes("junior")||j.seniorityTag.toLowerCase().includes("intern")?"pill-green":""}`} style={{fontSize:"11px",padding:"2px 6px"}}>{j.seniorityTag}</span>}
                    </div>
                  </td>
                  <td><span className="table-location"><MapPin size={13}/>{j.location||"—"}</span></td>
                  <td><span className={`pill ${((j.workMode||"").toLowerCase().includes("remote"))?"pill-green":""}`}>{j.workMode||"Not specified"}</span></td>
                  <td>{prettyDate(j.postedOn)}</td>
                  <td>
                    <div className="table-actions">
                      <button className={`icon-button small ${bookmarks.includes(j.id)?"is-bookmarked":""}`} title="Bookmark" onClick={()=>onBookmark(j.id)}>
                        {bookmarks.includes(j.id)?<BookmarkCheck size={16}/>:<Bookmark size={16}/>}
                      </button>
                      <button className="icon-button small" onClick={()=>onOpen(j)} title="View details">
                        <ArrowUpRight size={16}/>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>}
      <div className="pagination">
        <span>Page {page} of {pages}</span>
        <div>
          <button className="icon-button small" disabled={page===1} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/></button>
          <button className="icon-button small" disabled={page===pages} onClick={()=>setPage(p=>p+1)}><ChevronRight size={16}/></button>
        </div>
      </div>
    </div>
  </div>;
}

function ProfilePage({
  profile,onSave,jobs,goldCount,greenCount
}:{
  profile:UserProfile,onSave:(p:UserProfile)=>void,jobs:Job[],
  goldCount:number,greenCount:number
}) {
  const navigate = useNavigate();
  const [name,setName] = useState(profile.name);
  const [title,setTitle] = useState(profile.title);
  const [exp,setExp] = useState(String(profile.experienceYears));
  const [workMode,setWorkMode] = useState(profile.preferredWorkMode || "Any");
  const [dept,setDept] = useState(profile.targetDepartment || "All departments");
  const [skills,setSkills] = useState<string[]>(profile.skills || []);
  const [newSkill,setNewSkill] = useState("");
  const [resumeText,setResumeText] = useState(profile.resumeText || "");
  const [resumeFileName,setResumeFileName] = useState(profile.resumeFileName || "");
  const [analyzing,setAnalyzing] = useState(false);
  const [saveSuccess,setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allKnownSkills = useMemo(() => {
    return Array.from(new Set(jobs.flatMap(j => j.skills))).filter(Boolean);
  }, [jobs]);

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = skillToAdd.trim().toLowerCase();
    if (!trimmed) return;
    if (!skills.some(s => s.toLowerCase() === trimmed)) {
      setSkills(prev => [...prev, skillToAdd.trim()]);
    }
    setNewSkill("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(prev => prev.filter(s => s.toLowerCase() !== skillToRemove.toLowerCase()));
  };

  const handleFileUpload = async (file: File) => {
    setAnalyzing(true);
    setResumeFileName(file.name);
    try {
      const extractedText = await extractTextFromFile(file);
      setResumeText(extractedText);
      
      const detectedSkills = extractSkillsFromText(extractedText, allKnownSkills);
      const detectedExp = detectExperienceFromText(extractedText);
      const detectedName = detectNameFromText(extractedText);
      const detectedTitle = detectTitleFromText(extractedText);
      
      if (detectedSkills.length > 0) {
        setSkills(prev => Array.from(new Set([...prev, ...detectedSkills])));
      }
      if (detectedExp !== null) {
        setExp(String(detectedExp));
      }
      if (detectedName && (!name.trim() || name === "Candidate")) {
        setName(detectedName);
      }
      if (detectedTitle && !title.trim()) {
        setTitle(detectedTitle);
      }
      
      alert(`Resume processed successfully! Detected ${detectedSkills.length} skills${detectedName ? ` for ${detectedName}` : ""} from your resume.`);
    } catch (e) {
      console.error(e);
      alert("Could not extract text from file. You can paste your resume text directly into the box below.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleScanText = () => {
    if (!resumeText.trim()) return;
    const detectedSkills = extractSkillsFromText(resumeText, allKnownSkills);
    const detectedExp = detectExperienceFromText(resumeText);
    if (detectedSkills.length > 0) {
      setSkills(prev => Array.from(new Set([...prev, ...detectedSkills])));
    }
    if (detectedExp !== null) {
      setExp(String(detectedExp));
    }
    alert(`Detected ${detectedSkills.length} skills from text!`);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const updated: UserProfile = {
      name: name.trim() || "Candidate",
      title: title.trim(),
      experienceYears: Math.max(0, parseInt(exp, 10) || 0),
      skills,
      targetDepartment: dept,
      preferredWorkMode: workMode,
      resumeFileName,
      resumeText,
      resumeUploadedAt: new Date().toISOString()
    };
    onSave(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const popularSuggestions = ["React", "TypeScript", "Python", "SQL", "AWS", "Docker", "Java", "Node.js", "AI", "Kubernetes", "Git"];

  return <div className="page-stack">
    <SectionHeading
      eyebrow="YOUR LOCAL PROFILE"
      title="My Profile & Resume"
      description="Personalize your skills and upload your resume. RoleRadar matches jobs in real-time and highlights Golden Opportunities (≥ 80% fit) with glowing gold & green outlines."
      action={
        <button className="button button-primary" onClick={()=>handleSubmit()}>
          {saveSuccess ? <><Check size={16}/> Saved to device!</> : "Save Profile"}
        </button>
      }
    />

    <div className="profile-grid">
      {/* Left Column: Personal info & Skills */}
      <div className="panel profile-card">
        <h2 style={{font:"700 16px 'Bricolage Grotesque Variable'",marginBottom:"18px"}}>Career & Background</h2>
        
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
          <div className="form-field">
            <label>Your Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Alex Sharma"/>
          </div>
          <div className="form-field">
            <label>Target Role / Headline</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Frontend Engineer, Data Scientist"/>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"14px"}}>
          <div className="form-field">
            <label>Years of Experience</label>
            <input type="number" min="0" max="30" value={exp} onChange={e=>setExp(e.target.value)}/>
          </div>
          <div className="form-field">
            <label>Preferred Work Mode</label>
            <select value={workMode} onChange={e=>setWorkMode(e.target.value)}>
              <option value="Any">Any work mode</option>
              <option value="Remote">Remote only</option>
              <option value="Hybrid">Hybrid</option>
              <option value="Onsite">Onsite</option>
            </select>
          </div>
        </div>

        <div className="form-field">
          <label>Skills & Technologies ({skills.length})</label>
          <div className="skills-box">
            {skills.map(s => (
              <span key={s} className="skill-chip">
                {s}
                <button type="button" onClick={()=>handleRemoveSkill(s)} title="Remove skill"><X size={12}/></button>
              </span>
            ))}
          </div>
          <div style={{display:"flex",gap:"8px",marginTop:"8px"}}>
            <input
              style={{flex:1}}
              placeholder="Type a skill and press Enter..."
              value={newSkill}
              onChange={e=>setNewSkill(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();handleAddSkill(newSkill);}}}
            />
            <button type="button" className="button button-secondary" onClick={()=>handleAddSkill(newSkill)}>
              Add Skill
            </button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px",marginTop:"9px"}}>
            <small style={{color:"var(--muted)",fontSize:"12px"}}>Quick tap to add:</small>
            {popularSuggestions.filter(s => !skills.some(x => x.toLowerCase() === s.toLowerCase())).map(s => (
              <button
                key={s}
                type="button"
                onClick={()=>handleAddSkill(s)}
                style={{border:"1px solid var(--line)",background:"var(--panel)",borderRadius:"6px",padding:"2px 7px",fontSize:"11.5px",color:"var(--muted)",cursor:"pointer"}}
              >
                + {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Resume Uploader & Live Matches */}
      <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
        {/* Match Overview Box */}
        <div className="panel match-overview-card">
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <Sparkles size={18} color="#F5B700"/>
            <strong style={{fontSize:"15px",color:"var(--text)"}}>Live Opportunity Radar</strong>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
            <div style={{background:"var(--panel)",borderRadius:"8px",padding:"12px",border:"1px solid rgba(245,183,0,0.3)"}}>
              <span className="badge-gold-glow" style={{marginBottom:"4px"}}>
                <Sparkles size={11}/> Golden (≥ 80%)
              </span>
              <div style={{font:"800 24px 'Bricolage Grotesque Variable'",color:"#B28000"}}>{goldCount}</div>
              <small style={{color:"var(--muted)",fontSize:"11.5px"}}>High-confidence matches</small>
            </div>
            <div style={{background:"var(--panel)",borderRadius:"8px",padding:"12px",border:"1px solid rgba(16,185,129,0.3)"}}>
              <span className="badge-green-glow" style={{marginBottom:"4px"}}>
                <Check size={11}/> Potential (≥ 50%)
              </span>
              <div style={{font:"800 24px 'Bricolage Grotesque Variable'",color:"#10B981"}}>{greenCount}</div>
              <small style={{color:"var(--muted)",fontSize:"11.5px"}}>Viable opportunities</small>
            </div>
          </div>
          <button className="button button-primary" onClick={()=>navigate("/jobs?match=gold")}>
            View {goldCount} Golden Matches <ArrowUpRight size={15}/>
          </button>
        </div>

        {/* Resume Upload Panel */}
        <div className="panel profile-card">
          <h2 style={{font:"700 15px 'Bricolage Grotesque Variable'",marginBottom:"14px",display:"flex",alignItems:"center",gap:"8px"}}>
            <FileText size={16}/> Resume Upload & Parser
          </h2>
          <div
            className="resume-uploader"
            onClick={()=>fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.docx,.md"
              style={{display:"none"}}
              onChange={e=>{if(e.target.files?.[0])handleFileUpload(e.target.files[0]);}}
            />
            <Upload size={28} color="var(--blue)" style={{margin:"0 auto 8px"}}/>
            <strong style={{display:"block",fontSize:"13.5px",color:"var(--text)"}}>
              {analyzing ? "Analyzing resume text..." : resumeFileName ? `Uploaded: ${resumeFileName}` : "Click or drag your resume (.pdf, .txt, .docx)"}
            </strong>
            <small style={{color:"var(--muted)",fontSize:"12px"}}>
              100% private to your browser · No files uploaded to any server
            </small>
          </div>

          <div style={{marginTop:"14px"}}>
            <details style={{fontSize:"12.5px",color:"var(--muted)"}}>
              <summary style={{cursor:"pointer",fontWeight:600}}>Or paste resume text directly</summary>
              <textarea
                style={{width:"100%",height:"110px",marginTop:"8px",fontSize:"12px",fontFamily:"monospace"}}
                placeholder="Paste summary, skills, or resume text here..."
                value={resumeText}
                onChange={e=>setResumeText(e.target.value)}
              />
              <button
                type="button"
                className="button button-secondary"
                style={{marginTop:"6px",fontSize:"12px",padding:"6px 10px"}}
                onClick={handleScanText}
              >
                Scan Text for Skills
              </button>
            </details>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function Departments({jobs}:{jobs:Job[]}) {
  const navigate = useNavigate();
  const counts=Object.entries(jobs.reduce((a,j)=>{const k=j.department||"Other";a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
  const icons=[BriefcaseBusiness,ShieldCheck,Wifi,Database,Activity,Layers3,Building2,Command];
  return <div className="page-stack">
    <SectionHeading eyebrow="EXPLORE BY CATEGORY" title="Departments" description="Discover opportunities across every category found in your workbooks."/>
    <div className="department-grid">
      {counts.map(([name,count],i)=>{
        const Icon=icons[i%icons.length];
        return <button className="department-card" key={name} onClick={()=>navigate("/jobs?department="+encodeURIComponent(name))}>
          <div className="department-icon"><Icon size={19}/></div>
          <div className="department-copy"><strong>{name}</strong><span>{compactNumber(count)} opportunities</span></div>
          <ArrowUpRight size={16} className="department-arrow"/>
        </button>;
      })}
    </div>
  </div>;
}

function ApplicationsPage({jobs,applications,onStatus,onRemove,onPatch}:{onPatch:(a:Application)=>void,jobs:Job[],applications:Application[],onStatus:(id:string,s:ApplicationStatus)=>void,onRemove:(id:string)=>void}) {
  const [filter,setFilter]=useState("all");
  const rows=applications.filter(a=>filter==="all"||a.status===filter).map(a=>({app:a,job:jobs.find(j=>j.id===a.jobId)}));
  return <div className="page-stack">
    <SectionHeading eyebrow="YOUR CAREER PIPELINE" title="Application tracker" description="Keep your applications, follow-ups and interview progress organized."/>
    <div className="tracker-stats">
      {statuses.slice(0,6).map(s=><button className={`tracker-stat ${filter===s?"selected":""}`} key={s} onClick={()=>setFilter(filter===s?"all":s)}><span>{statusLabel[s]}</span><strong>{applications.filter(a=>a.status===s).length}</strong></button>)}
    </div>
    <div className="panel">
      <div className="panel-heading"><div><h2>Tracked opportunities</h2><p>{rows.length} applications in this view · stored on this device</p></div><button className="button button-quiet" onClick={()=>setFilter("all")}>All statuses</button></div>
      {rows.length===0?<div className="empty-state"><ClipboardList size={28}/><strong>Your tracker is ready</strong><span>Open a job and choose a status to start tracking it.</span></div>:
      <div className="application-list">
        {rows.map(({app,job})=><div className="application-row" key={app.id}>
          <div className="company-logo">{initials(job?.company||"Archived")}</div>
          <div className="application-main"><strong>{job?.title||"Archived opportunity"}</strong><span>{job?.company||"No longer in current dataset"}</span></div>
          <select value={app.status} onChange={e=>onStatus(app.jobId,e.target.value as ApplicationStatus)}>
            {statuses.map(s=><option value={s} key={s}>{statusLabel[s]}</option>)}
          </select>
          <input className="track-select" type="date" title="Follow-up date" value={app.followUpDate||""} onChange={e=>onPatch({...app,followUpDate:e.target.value||null})}/>
          <input className="track-select note-input" placeholder="Notes" defaultValue={app.notes} onBlur={e=>e.target.value!==app.notes&&onPatch({...app,notes:e.target.value})}/><button className="icon-button small" title="Remove" onClick={()=>onRemove(app.id)}><X size={16}/></button>
        </div>)}
      </div>}
    </div>
  </div>;
}

function Analytics({jobs,meta}:{jobs:Job[],meta:Metadata|null}) {
  const byLevel=Object.entries(jobs.reduce((a,j)=>{const k=j.level||"Not specified";a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
  const byMode=Object.entries(jobs.reduce((a,j)=>{const k=j.workMode||"Not specified";a[k]=(a[k]||0)+1;return a;},{} as Record<string,number>)).map(([name,value])=>({name,value}));
  return <div className="page-stack">
    <SectionHeading eyebrow="DATA INSIGHTS" title="Analytics" description="Understand the shape of your opportunity landscape."/>
    <div className="stats-grid">
      <StatCard label="Unique jobs" value={compactNumber(jobs.length)} change="Consolidated" icon={BriefcaseBusiness}/>
      <StatCard label="Departments" value={String(meta?.departments?.length||0)} change="Discovered dynamically" icon={Layers3} tint="violet"/>
      <StatCard label="Locations" value={compactNumber(meta?.locations?.length||0)} change="Across markets" icon={MapPin} tint="green"/>
      <StatCard label="Workbooks" value={String(meta?.workbooksProcessed||0)} change="Processed sources" icon={FileSpreadsheet} tint="orange"/>
    </div>
    <div className="dashboard-grid">
      <div className="panel chart-panel">
        <div className="panel-heading"><div><h2>Seniority distribution</h2><p>Records by level</p></div></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byLevel}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
              <XAxis dataKey="name" tick={{fontSize:11,fill:"var(--muted)"}}/>
              <YAxis tick={{fontSize:11,fill:"var(--muted)"}}/>
              <Tooltip/>
              <Bar dataKey="value" fill="#5b7cfa" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="panel chart-panel">
        <div className="panel-heading"><div><h2>Work arrangements</h2><p>Remote, hybrid and onsite</p></div></div>
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byMode} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/>
              <XAxis type="number" tick={{fontSize:11,fill:"var(--muted)"}}/>
              <YAxis type="category" dataKey="name" width={100} tick={{fontSize:11,fill:"var(--muted)"}}/>
              <Tooltip/>
              <Bar dataKey="value" fill="#35b78a" radius={[0,5,5,0]}/></BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  </div>;
}

function Sources({meta}:{meta:Metadata|null}) {
  return <div className="page-stack">
    <SectionHeading eyebrow="DATA PIPELINE" title="Data sources" description="A transparent view of the workbooks feeding your RoleRadar database."/>
    <div className="stats-grid">
      <StatCard label="Raw records" value={compactNumber(meta?.rawRecords||0)} change="Before deduplication" icon={FileSpreadsheet}/>
      <StatCard label="Unique jobs" value={compactNumber(meta?.uniqueJobs||0)} change="After deduplication" icon={Database} tint="violet"/>
      <StatCard label="Duplicates removed" value={compactNumber(meta?.duplicatesRemoved||0)} change="Conservative matching" icon={RefreshCw} tint="green"/>
      <StatCard label="Worksheets scanned" value={String(meta?.worksheetsProcessed||0)} change="Summary sheets excluded" icon={Layers3} tint="orange"/>
    </div>
    <div className="panel">
      <div className="panel-heading"><div><h2>Processed workbooks</h2><p>Original Excel files committed to the repository</p></div><span className="pill pill-green">Pipeline healthy</span></div>
      {(meta?.sourceFiles??[]).map((file:string,i:number)=><div className="source-file" key={file}>
        <div className="source-icon"><FileSpreadsheet size={21}/></div>
        <div className="source-main"><strong>{file.split("/").pop()}</strong><span>data/{file} · source workbook {i+1}</span></div>
        <span className="status-dot"/>
      </div>)}
      <div className="sheet-breakdown">
        <h3>Worksheet breakdown</h3>
        <div className="sheet-grid">{Object.entries(meta?.sheetCounts||{}).sort((a,b)=>b[1]-a[1]).map(([name,count])=><div className="sheet-item" key={name}><span>{name}</span><strong>{compactNumber(count)}</strong></div>)}</div>
      </div>
      <div className="source-footnote"><CircleHelp size={15}/> Add future .xlsx files under data/. The next GitHub Actions deployment will automatically include them.</div>
    </div>
  </div>;
}

function SettingsPage({theme,setTheme,onExport,onImport}:{theme:"light"|"dark",setTheme:(t:"light"|"dark")=>void,onExport:()=>void,onImport:(f:File)=>void}) {
  return <div className="page-stack">
    <SectionHeading eyebrow="PREFERENCES" title="Settings" description="Make your workspace feel just right."/>
    <div className="settings-grid">
      <section className="panel settings-panel">
        <div className="settings-title"><div className="settings-icon"><Sun size={18}/></div><div><h2>Appearance</h2><p>Choose how RoleRadar looks.</p></div></div>
        <div className="theme-options">
          <button className={`theme-option ${theme==="light"?"chosen":""}`} onClick={()=>setTheme("light")}>
            <div className="theme-preview light-preview"><span/><span/><span/></div>
            <strong>Light</strong>
            {theme==="light"&&<Check size={15}/>}
          </button>
          <button className={`theme-option ${theme==="dark"?"chosen":""}`} onClick={()=>setTheme("dark")}>
            <div className="theme-preview dark-preview"><span/><span/><span/></div>
            <strong>Dark</strong>
            {theme==="dark"&&<Check size={15}/>}
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <div className="settings-title"><div className="settings-icon"><Database size={18}/></div><div><h2>Personal data</h2><p>Bookmarks, profile, and applications stay in this browser.</p></div></div>
        <div className="setting-action">
          <div><strong>Export backup</strong><span>Download bookmarks, profile and application records as JSON.</span></div>
          <button className="button button-secondary" onClick={onExport}><Download size={15}/> Export</button>
        </div>
        <div className="setting-action">
          <div><strong>Restore backup</strong><span>Import a previously exported JSON backup.</span></div>
          <label className="button button-secondary upload-button">
            <Download size={15}/> Import
            <input type="file" accept="application/json" onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/>
          </label>
        </div>
      </section>
      <section className="panel privacy-panel">
        <ShieldCheck size={20}/>
        <div>
          <strong>Your data stays yours.</strong>
          <p>The repository contains public job listings only. Bookmarks, notes, custom profiles, and application tracking are stored locally in IndexedDB and are never uploaded to GitHub.</p>
        </div>
      </section>
    </div>
  </div>;
}

function JobModal({
  job,bookmarked,currentStatus,match,profile,onClose,onBookmark,onTrack
}:{
  job:Job,bookmarked:boolean,currentStatus?:ApplicationStatus,
  match?:JobMatchResult,profile?:UserProfile,onClose:()=>void,
  onBookmark:()=>void,onTrack:(id:string,s:ApplicationStatus)=>void
}) {
  const navigate = useNavigate();
  const [copiedPitch,setCopiedPitch] = useState(false);

  const handleCopyPitch = () => {
    if (!profile || !match) return;
    const pitch = generatePersonalizedPitch(job, profile, match);
    navigator.clipboard.writeText(pitch);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2500);
  };

  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <div className="job-modal">
      <div className="modal-top">
        <div className="company-logo large">{initials(job.company || "?")}</div>
        <button className="icon-button" onClick={onClose}><X size={19}/></button>
      </div>
      <div className="modal-company">{job.company}</div>
      <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",margin:"8px 0 12px"}}>
        <h2 style={{margin:0}}>{job.title}</h2>
        {match?.tier === "gold" && (
          <span className="badge-gold-glow">
            <Sparkles size={12}/> Golden Opportunity · {match.score}%
          </span>
        )}
        {match?.tier === "green" && (
          <span className="badge-green-glow">
            <Check size={12}/> Potential Match · {match.score}%
          </span>
        )}
      </div>

      <div className="modal-tags">
        <span><Layers3 size={13}/>{job.department||"Other"}</span>
        <span><MapPin size={13}/>{job.location||"Location not listed"}</span>
        <span><Clock3 size={13}/>{job.experience||"Experience not specified"}</span>
        {job.seniorityTag && <span><GraduationCap size={13}/>{job.seniorityTag}</span>}
      </div>

      {/* Resume Match Breakdown */}
      {match && match.tier !== "none" && (
        <div style={{
          marginTop:"18px",padding:"14px",borderRadius:"10px",
          background: match.tier === "gold" ? "linear-gradient(135deg,rgba(245,183,0,0.12),rgba(245,183,0,0.04))" : "linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.02))",
          border: match.tier === "gold" ? "1px solid rgba(245,183,0,0.35)" : "1px solid rgba(16,185,129,0.3)"
        }}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}}>
            <strong style={{fontSize:"13px",color:"var(--text)"}}>Resume Fit Analysis</strong>
            <span style={{fontSize:"12px",fontWeight:700,color:match.tier==="gold"?"#B28000":"#10B981"}}>{match.score}% Score</span>
          </div>
          <p style={{fontSize:"12.5px",margin:"0 0 10px",color:"var(--muted)",lineHeight:1.5}}>{match.matchReason}</p>
          {match.matchedSkills.length > 0 && (
            <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap",marginBottom:"8px"}}>
              <small style={{fontSize:"11.5px",color:"var(--text)",fontWeight:600}}>Matching skills:</small>
              {match.matchedSkills.map(s => (
                <span key={s} style={{background:match.tier==="gold"?"#FFE082":"#A7F3D0",color:match.tier==="gold"?"#7A5300":"#065F46",padding:"2px 6px",borderRadius:"4px",fontSize:"11px",fontWeight:700}}>
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
          {profile && (
            <button
              type="button"
              className="button button-secondary"
              style={{marginTop:"4px",fontSize:"12px",padding:"6px 10px"}}
              onClick={handleCopyPitch}
            >
              {copiedPitch ? <><CheckCheck size={14} color="#10B981"/> Copied pitch to clipboard!</> : <><Copy size={14}/> Copy application pitch note</>}
            </button>
          )}
        </div>
      )}

      <div className="detail-grid">
        {[["Work mode",job.workMode],["Employment",job.employmentType],["Seniority",job.seniorityTag||job.level],["Salary",job.salary],["Posted",prettyDate(job.postedOn)],["Market",job.market]].map(([k,v])=><div className="detail-cell" key={k}>
          <span>{k}</span><strong>{v||"Not specified"}</strong>
        </div>)}
      </div>

      {job.skills.length>0&&<div className="modal-section">
        <h3>Skills & technologies</h3>
        <div className="skill-tags">
          {job.skills.map(s=><a key={s} href={"#/jobs?skill="+encodeURIComponent(s)} onClick={(e)=>{e.preventDefault();onClose();navigate("/jobs?skill="+encodeURIComponent(s));}}>{s}</a>)}
        </div>
      </div>}

      <div className="modal-section">
        <h3>Source</h3>
        <p className="source-text">{job.sourceFiles.join(", ")} · {job.sourceSheets.join(", ")}</p>
      </div>

      <div className="modal-actions">
        <button className="button button-secondary" onClick={onBookmark}>
          {bookmarked?<BookmarkCheck size={16}/>:<Bookmark size={16}/>} {bookmarked?"Saved":"Save job"}
        </button>
        <select
          className="track-select"
          value={currentStatus || ""}
          onChange={e=>e.target.value&&onTrack(job.id,e.target.value as ApplicationStatus)}
        >
          <option value="" disabled>{currentStatus ? `Tracked: ${statusLabel[currentStatus]}` : "Track application…"}</option>
          {statuses.map(s=><option value={s} key={s}>{statusLabel[s]}</option>)}
        </select>
        {job.applyUrl?<a className="button button-primary" href={job.applyUrl} target="_blank" rel="noopener noreferrer">Apply now <ExternalLink size={15}/></a>:<button className="button button-primary" disabled>Apply link unavailable</button>}
      </div>
    </div>
  </div>;
}

function downloadCsv(jobs:Job[]) {
  const cols = [
    "title", "company", "department", "level", "seniorityTag",
    "experience", "employmentType", "workMode", "location",
    "salary", "skills", "postedOn", "applyUrl"
  ];
  const csv = [
    cols.join(","),
    ...jobs.map(j => cols.map(c => {
      const val = (j as any)[c];
      const strVal = Array.isArray(val) ? val.join("; ") : (val ?? "");
      return `"${String(strVal).replace(/"/g,'""')}"`;
    }).join(","))
  ].join("\n");
  const blob = new Blob([csv],{type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "roleradar-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}
