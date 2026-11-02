export interface Job {
  id: string;
  title: string;
  company: string;
  department: string | null;
  level: string | null;
  seniorityTag: string | null;
  experience: string | null;
  employmentType: string | null;
  workMode: string | null;
  location: string | null;
  market: string | null;
  salary: string | null;
  companyType: string | null;
  skills: string[];
  postedOn: string | null;
  freshness: string | null;
  applyUrl: string | null;
  sourceFiles: string[];
  sourceSheets: string[];
  searchText: string;
}
export interface Metadata {
  generatedAt: string;
  sourceFiles?: string[];
  rawRecords: number;
  uniqueJobs: number;
  duplicatesRemoved: number;
  invalidRows: number;
  workbooksProcessed: number;
  worksheetsProcessed: number;
  departments: string[];
  locations: string[];
  companies: string[];
  workModes: string[];
  employmentTypes: string[];
  levels: string[];
  sheetCounts: Record<string, number>;
}
export type ApplicationStatus = "interested" | "saved" | "applied" | "assessment" | "interview" | "offer" | "rejected";
export interface Application {
  id: string;
  jobId: string;
  status: ApplicationStatus;
  appliedDate: string | null;
  followUpDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  title: string;
  experienceYears: number;
  skills: string[];
  targetDepartment: string;
  preferredWorkMode: string;
  resumeFileName?: string;
  resumeText?: string;
  resumeUploadedAt?: string;
}

export interface JobMatchResult {
  score: number;
  tier: "gold" | "green" | "none";
  matchedSkills: string[];
  missingSkills: string[];
  experienceFit: boolean;
  matchReason: string;
}
