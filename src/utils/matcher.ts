import type { Job, JobMatchResult, UserProfile } from "../types/job";
import { inflateRaw } from "./inflate";

// Comprehensive canonical skill mappings and synonyms
export const SKILL_ALIASES: Record<string, string[]> = {
  // Cybersecurity & InfoSec
  "cybersecurity": ["cybersecurity", "cyber security", "infosec", "information security", "defensive security"],
  "network-security": ["network security", "computer networks", "networking", "firewall", "vpn"],
  "web-security": ["web security", "web application security", "application security", "appsec"],
  "soc": ["soc", "soc analyst", "soc fundamentals", "siem", "log analysis", "security operations"],
  "penetration-testing": ["penetration testing", "vulnerability assessment", "pen testing", "pentest", "ethical hacking", "tryhackme"],
  "burp-suite": ["burp suite", "burpsuite"],
  "nmap": ["nmap"],

  // Programming Languages
  "python": ["python", "py", "django", "fastapi", "flask"],
  "java": ["java", "servlets", "swing", "spring", "spring boot", "springboot"],
  "javascript": ["javascript", "js", "ecmascript"],
  "typescript": ["typescript", "ts"],
  "c++": ["c++", "cpp"],
  "c": [" c ", "c programming", "embedded c"],
  "golang": ["golang", "go"],
  "rust": ["rust"],
  "c#": ["c#", "csharp", ".net", "dotnet", "asp.net"],

  // Frontend & Web Development
  "react": ["react", "react.js", "reactjs", "react-native", "react native"],
  "next.js": ["next.js", "nextjs", "next"],
  "vue": ["vue", "vue.js", "vuejs"],
  "angular": ["angular", "angularjs"],
  "html": ["html", "html5"],
  "css": ["css", "css3"],
  "tailwind": ["tailwind", "tailwindcss"],

  // Backend & APIs
  "node.js": ["node", "node.js", "nodejs", "nest", "nestjs"],
  "express": ["express", "express.js"],
  "api": ["api", "rest", "rest api", "restful", "restful api", "graphql", "microservices", "grpc"],

  // Databases & Storage
  "sql": ["sql", "sqlite", "plsql", "t-sql", "dbms"],
  "mysql": ["mysql"],
  "postgresql": ["postgresql", "postgres"],
  "oracle": ["oracle", "oracle 10g", "oracle db"],
  "nosql": ["nosql", "mongodb", "dynamodb", "redis", "cassandra"],
  "mongodb": ["mongodb", "mongo"],

  // Cloud & DevOps
  "aws": ["aws", "amazon web services", "ec2", "s3", "lambda", "cloudformation"],
  "azure": ["azure", "microsoft azure"],
  "gcp": ["gcp", "google cloud", "google cloud platform", "bigquery"],
  "docker": ["docker", "container", "containers", "containerization"],
  "kubernetes": ["kubernetes", "k8s"],
  "ci-cd": ["ci/cd", "ci-cd", "github actions", "gitlab ci", "jenkins"],
  "git": ["git", "github", "gitlab"],
  "linux": ["linux", "ubuntu", "kali", "debian", "redhat", "centos", "unix", "bash", "shell"],
  "devops": ["devops", "terraform", "ansible", "helm"],

  // Data & AI
  "machine-learning": ["machine learning", "ml", "deep learning", "nlp", "computer vision", "pytorch", "tensorflow", "scikit-learn"],
  "ai": ["ai", "artificial intelligence", "genai", "generative ai", "llm", "agentic-ai", "langchain"],
  "analytics": ["analytics", "power bi", "powerbi", "tableau", "excel", "data analysis", "pandas", "numpy"],
  "automation": ["automation", "qa", "qa automation", "selenium", "cypress", "playwright", "testing", "unit test", "jest"]
};

export function parseExperienceYears(exp: string | null | undefined): number | null {
  if (!exp) return null;
  const match = exp.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function isFresherJob(j: Job): boolean {
  const labels = `${j.level || ""} ${j.seniorityTag || ""}`.toLowerCase();
  const exp = (j.experience || "").toLowerCase().trim();
  if (/senior|lead|principal|staff|manager|director|head|chief/.test(labels)) return false;
  if (/junior|fresher|entry|intern|graduate|trainee/.test(labels)) return true;
  return /^(0|0\s*\+|0\s*[-–]\s*[12]|1\s*[-–]\s*2)(\s*(yrs?|years?))?$/.test(exp);
}

function normalizeSkill(s: string): string {
  return s.toLowerCase().replace(/[\s/_-]+/g, "-").trim();
}

export function extractSkillsFromText(text: string, knownSkills: string[] = []): string[] {
  if (!text) return [];
  // Ensure padded text with single spaces
  const clean = text.replace(/[\r\n]+/g, " ");
  const normalizedText = " " + clean.toLowerCase() + " ";
  const detected = new Set<string>();

  // 1. Check against SKILL_ALIASES dictionary
  for (const [canonical, variants] of Object.entries(SKILL_ALIASES)) {
    for (const v of variants) {
      let rx: RegExp;
      if (v === "c" || v === " c ") {
        rx = /(?:^|[^a-z0-9+#])c(?:$|[^a-z0-9+#])/i;
      } else if (v === "c++") {
        rx = /(?:^|[^a-z0-9+#])c\+\+(?:$|[^a-z0-9+#])/i;
      } else if (v === "c#") {
        rx = /(?:^|[^a-z0-9+#])c#(?:$|[^a-z0-9+#])/i;
      } else {
        const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        rx = new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:$|[^a-z0-9+#])`, "i");
      }

      if (rx.test(normalizedText)) {
        detected.add(canonical);
        break;
      }
    }
  }

  // 2. Check against known dataset skills
  for (const skill of knownSkills) {
    const s = skill.toLowerCase().trim();
    if (!s || s.length < 2 || detected.has(s)) continue;
    const escaped = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(`(?:^|[^a-z0-9+#])${escaped}(?:$|[^a-z0-9+#])`, "i");
    if (rx.test(normalizedText)) {
      detected.add(s);
    }
  }

  return Array.from(detected);
}

export function detectExperienceFromText(text: string): number | null {
  if (!text) return null;
  // Look for direct experience pattern: "X years experience"
  const match = text.match(/(\d+)\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+experience/i);
  if (match) return parseInt(match[1], 10);
  
  // Look for Fresher signals: graduation years 2024, 2025, 2026 or "MCA", "BTech", "Fresher", "Intern"
  if (/fresher|recent graduate|entry[- ]level|student|intern|aspiring/i.test(text)) return 0;
  if (/202[4-6]\s*[-–]\s*202[5-7]|2023\s*[-–]\s*2025/i.test(text)) return 0;
  
  return null;
}

export function detectNameFromText(text: string): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 2 && l.length < 45);
  for (const line of lines.slice(0, 5)) {
    if (/^(resume|curriculum|cv|profile|summary|contact|experience|education|skills)/i.test(line)) continue;
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*\s+[A-Z][a-z]+$/.test(line)) {
      return line;
    }
  }
  return null;
}

export function detectTitleFromText(text: string): string | null {
  if (!text) return null;
  // Look for target role in summary or headline
  if (/cybersecurity|security/i.test(text)) {
    if (/penetration|soc analyst|vulnerability/i.test(text)) return "Cybersecurity & SOC Analyst";
    return "Cybersecurity Specialist";
  }
  if (/full[- ]?stack/i.test(text)) return "Full Stack Engineer";
  if (/frontend|react/i.test(text)) return "Frontend Engineer";
  if (/backend|node|python|java/i.test(text)) return "Backend Engineer";
  if (/data analyst|analytics/i.test(text)) return "Data Analyst";
  return null;
}

// Client-side PDF stream decompressor with pure JS fallback
async function decompressPdfChunk(chunk: Uint8Array): Promise<string> {
  const clean = chunk.slice(); // Guarantee independent ArrayBuffer with byteOffset = 0

  // 1. Try browser native DecompressionStream if available
  if (typeof DecompressionStream !== "undefined") {
    // Attempt A: Standard zlib "deflate" (RFC 1950)
    try {
      const ds = new DecompressionStream("deflate");
      const resp = new Response(clean);
      if (resp.body) {
        const stream = resp.body.pipeThrough(ds);
        const buf = await new Response(stream).arrayBuffer();
        return new TextDecoder("latin1").decode(buf);
      }
    } catch {}

    // Attempt B: "deflate-raw" (strip 2 byte zlib header and 4 byte Adler-32 checksum)
    if (clean.length > 6 && clean[0] === 0x78) {
      try {
        const raw = clean.slice(2, clean.length - 4);
        const ds = new DecompressionStream("deflate-raw");
        const resp = new Response(raw);
        if (resp.body) {
          const stream = resp.body.pipeThrough(ds);
          const buf = await new Response(stream).arrayBuffer();
          return new TextDecoder("latin1").decode(buf);
        }
      } catch {}
    }
  }

  // 2. Pure JavaScript synchronous Inflate fallback (works across all browsers and offline)
  try {
    const raw = (clean.length > 6 && clean[0] === 0x78) ? clean.subarray(2, clean.length - 4) : clean;
    const inflated = inflateRaw(raw);
    if (inflated && inflated.length > 0) {
      return new TextDecoder("latin1").decode(inflated);
    }
  } catch {}

  return "";
}

export async function extractTextFromFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  
  if (extension === "txt" || extension === "md" || extension === "json" || extension === "csv") {
    return await file.text();
  }

  // Client-side PDF parser with ToUnicode CMap & CID font support
  if (extension === "pdf") {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const latinText = new TextDecoder("latin1").decode(bytes);

      // Step 1: Collect all decompressed streams accurately by following dictionary boundaries
      const decompressedStreams: string[] = [];
      let pos = 0;

      while (pos < latinText.length) {
        const dictEnd = latinText.indexOf(">>", pos);
        if (dictEnd === -1) break;

        const streamIdx = latinText.indexOf("stream", dictEnd);
        if (streamIdx === -1) break;

        const between = latinText.substring(dictEnd + 2, streamIdx);
        // Only valid if only whitespace/newline exists between >> and stream
        if (!/^\s*$/.test(between)) {
          pos = dictEnd + 2;
          continue;
        }

        let dataStart = streamIdx + 6;
        if (bytes[dataStart] === 13 && bytes[dataStart + 1] === 10) {
          dataStart += 2;
        } else if (bytes[dataStart] === 10 || bytes[dataStart] === 13) {
          dataStart += 1;
        }

        const end = latinText.indexOf("endstream", dataStart);
        if (end === -1) break;

        // Advance search position past this stream so we NEVER parse inside binary stream data
        pos = end + 9;

        // Trim trailing CR / LF before endstream
        let dataEnd = end;
        while (dataEnd > dataStart && (bytes[dataEnd - 1] === 10 || bytes[dataEnd - 1] === 13)) {
          dataEnd--;
        }

        const chunk = bytes.slice(dataStart, dataEnd);
        if (chunk.length > 2) {
          if (chunk[0] === 0x78) {
            const decomp = await decompressPdfChunk(chunk);
            if (decomp) {
              decompressedStreams.push(decomp);
            }
          } else {
            decompressedStreams.push(new TextDecoder("latin1").decode(chunk));
          }
        }
      }

      // Step 2: Build global CID to Unicode map from all CMap streams
      const cMap = new Map<string, string>();
      for (const str of decompressedStreams) {
        if (str.includes("begincmap")) {
          // Parse beginbfchar
          const bfcharBlocks = Array.from(str.matchAll(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g));
          for (const b of bfcharBlocks) {
            const pairs = Array.from(b[1].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g));
            for (const p of pairs) {
              const src = p[1].toUpperCase().padStart(4, "0");
              let dst = "";
              for (let i = 0; i < p[2].length; i += 4) {
                if (i + 4 <= p[2].length) {
                  dst += String.fromCharCode(parseInt(p[2].substring(i, i + 4), 16));
                }
              }
              cMap.set(src, dst);
            }
          }

          // Parse beginbfrange
          const bfrangeBlocks = Array.from(str.matchAll(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g));
          for (const b of bfrangeBlocks) {
            // Single target range: <start> <end> <target>
            const ranges = Array.from(b[1].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>/g));
            for (const r of ranges) {
              const sHex = parseInt(r[1], 16);
              const eHex = parseInt(r[2], 16);
              const tHex = parseInt(r[3], 16);
              for (let i = 0; i <= eHex - sHex; i++) {
                const src = (sHex + i).toString(16).toUpperCase().padStart(4, "0");
                const dst = String.fromCharCode(tHex + i);
                cMap.set(src, dst);
              }
            }

            // Array target range: <start> <end> [ <target1> <target2> ... ]
            const arrayRanges = Array.from(b[1].matchAll(/<([0-9a-fA-F]+)>\s+<([0-9a-fA-F]+)>\s+\[([\s\S]*?)\]/g));
            for (const ar of arrayRanges) {
              const sHex = parseInt(ar[1], 16);
              const targets = Array.from(ar[3].matchAll(/<([0-9a-fA-F]+)>/g)).map(t => {
                let val = "";
                for (let i = 0; i < t[1].length; i += 4) {
                  if (i + 4 <= t[1].length) {
                    val += String.fromCharCode(parseInt(t[1].substring(i, i + 4), 16));
                  }
                }
                return val;
              });
              for (let i = 0; i < targets.length; i++) {
                const src = (sHex + i).toString(16).toUpperCase().padStart(4, "0");
                cMap.set(src, targets[i]);
              }
            }
          }
        }
      }

      // Step 3: Extract text from text blocks (BT ... ET)
      let extractedText = "";
      for (const stream of decompressedStreams) {
        if (stream.includes("BT") && stream.includes("ET")) {
          const tjMatches = Array.from(stream.matchAll(/(?:\[([\s\S]*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*T[jd]|\((.*?)\)\s*T[jd])/g));
          for (const m of tjMatches) {
            if (m[1]) {
              // Tokenize array by hex string or kerning number
              const tokens = Array.from(m[1].matchAll(/<([0-9a-fA-F]+)>|(-?\d+(?:\.\d+)?)/g));
              for (const tok of tokens) {
                if (tok[1]) {
                  const hex = tok[1];
                  for (let i = 0; i < hex.length; i += 4) {
                    if (i + 4 <= hex.length) {
                      const cid = hex.substring(i, i + 4).toUpperCase();
                      extractedText += cMap.get(cid) || (cid.length === 4 ? String.fromCharCode(parseInt(cid, 16)) : "");
                    }
                  }
                } else if (tok[2]) {
                  const kerning = parseFloat(tok[2]);
                  // Negative number <= -150 denotes a word space in PDF typesetting
                  if (kerning < -150) {
                    extractedText += " ";
                  }
                }
              }
              extractedText += " ";
            } else if (m[2]) {
              const hex = m[2];
              for (let i = 0; i < hex.length; i += 4) {
                if (i + 4 <= hex.length) {
                  const cid = hex.substring(i, i + 4).toUpperCase();
                  extractedText += cMap.get(cid) || (cid.length === 4 ? String.fromCharCode(parseInt(cid, 16)) : "");
                }
              }
              extractedText += " ";
            } else if (m[3]) {
              extractedText += m[3].replace(/\\([()\\])/g, "$1") + " ";
            }
            extractedText += "\n";
          }
        }
      }

      // Step 4: Reconnect hyphenated words (e.g. "struc-\ntured" -> "structured") and normalize whitespace
      if (extractedText.trim().length > 30) {
        const cleaned = extractedText
          .replace(/(\w+)-\s*\n\s*(\w+)/g, "$1$2")
          .replace(/[ \t]+/g, " ");
        return cleaned;
      }

      // Fallback: extract word tokens from ascii representation if text streams couldn't be parsed
      const tokens = latinText.match(/[A-Za-z0-9+#.-]{3,35}/g) || [];
      return tokens.slice(0, 3000).join(" ");
    } catch (e) {
      console.warn("PDF extraction fallback", e);
      return await file.text().catch(() => "");
    }
  }

  // Word docx extraction
  if (extension === "docx") {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const latinText = new TextDecoder("latin1").decode(bytes);
      const wtMatches = latinText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || [];
      if (wtMatches.length > 0) {
        return wtMatches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
      }
      const words = latinText.match(/[A-Za-z0-9+#.-]{3,35}/g) || [];
      return words.slice(0, 2000).join(" ");
    } catch (e) {
      console.warn("DOCX extraction fallback", e);
      return "";
    }
  }

  // General text extraction fallback
  try {
    return await file.text();
  } catch {
    return "";
  }
}

export function calculateJobMatch(job: Job, profile: UserProfile): JobMatchResult {
  const userSkills = (profile.skills || []).map(s => s.toLowerCase().trim()).filter(Boolean);
  const jobSkills = (job.skills || []).map(s => s.toLowerCase().trim()).filter(Boolean);
  
  // If user has not specified any skills or profile details, return none
  if (userSkills.length === 0 && !profile.title && !profile.experienceYears) {
    return {
      score: 0,
      tier: "none",
      matchedSkills: [],
      missingSkills: jobSkills,
      experienceFit: false,
      matchReason: "Add your skills or upload a resume to see personalized fit."
    };
  }

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const js of jobSkills) {
    const normJs = normalizeSkill(js);
    const isDirectMatch = userSkills.some(us => normalizeSkill(us) === normJs);
    const isAliasMatch = Object.entries(SKILL_ALIASES).some(([canon, aliases]) => 
      (aliases.some(a => normalizeSkill(a) === normJs) || canon === normJs) && 
      userSkills.some(us => aliases.some(a => normalizeSkill(a) === normalizeSkill(us)) || canon === normalizeSkill(us))
    );
    if (isDirectMatch || isAliasMatch) {
      matchedSkills.push(js);
    } else {
      missingSkills.push(js);
    }
  }

  const titleLower = (job.title || "").toLowerCase();
  const searchLower = (job.searchText || "").toLowerCase();

  // Role title bonus (max 10)
  let titleBonus = 0;
  if (profile.title) {
    const roleTokens = profile.title.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (roleTokens.some(tok => titleLower.includes(tok))) titleBonus = 10;
  }

  // Experience fit (max 30)
  const reqYears = parseExperienceYears(job.experience);
  const userYears = profile.experienceYears ?? 0;
  let expScore = 0;
  let experienceFit = false;

  if (reqYears !== null) {
    if (userYears >= reqYears && userYears <= reqYears + 2) {
      expScore = 30; // Sweet spot
      experienceFit = true;
    } else if (userYears === reqYears - 1) {
      expScore = 18; // Junior stretch
      experienceFit = true;
    } else if (userYears >= reqYears + 3) {
      expScore = 15; // Senior/overqualified
      experienceFit = true;
    } else {
      expScore = 0; // Underqualified
      experienceFit = false;
    }
  } else if (isFresherJob(job)) {
    if (userYears <= 2) {
      expScore = 30;
      experienceFit = true;
    } else {
      expScore = 18;
      experienceFit = true;
    }
  } else {
    expScore = 20;
    experienceFit = true;
  }

  // Skill Score (max 60)
  let skillScore = 0;
  if (jobSkills.length > 0) {
    const ratio = matchedSkills.length / jobSkills.length;
    if (ratio >= 1.0) {
      skillScore = 52 + Math.min(8, matchedSkills.length * 2);
    } else if (ratio >= 0.6) {
      skillScore = 40 + Math.min(10, Math.round(matchedSkills.length * 2.5));
    } else if (ratio >= 0.35) {
      skillScore = 26 + Math.min(8, matchedSkills.length * 2);
    } else if (matchedSkills.length >= 1) {
      skillScore = 15;
    }
  } else {
    // If no explicit skills tagged on job, match against title/searchText
    let inferredMatches = 0;
    for (const us of userSkills) {
      if (searchLower.includes(us) || titleLower.includes(us)) {
        inferredMatches++;
        matchedSkills.push(us);
      }
    }
    skillScore = Math.min(28, inferredMatches * 14);
  }

  const rawTotal = Math.min(100, Math.round(skillScore + expScore + titleBonus));

  // STRICT USER STANDARD:
  // Golden Opportunity: MUST be >= 80% (strictly no jobs below 80%)
  // Potential Match: 50% - 79%
  // Below 50%: none
  let tier: "gold" | "green" | "none" = "none";
  let matchReason = "";

  if (
    rawTotal >= 80 &&
    experienceFit &&
    (matchedSkills.length >= 2 || (jobSkills.length <= 1 && matchedSkills.length >= 1))
  ) {
    tier = "gold";
    matchReason = `Golden Opportunity (${rawTotal}% match)! ${matchedSkills.length} key skills match your profile and your experience (${userYears} yrs) is an ideal fit.`;
  } else if (
    rawTotal >= 50 &&
    (matchedSkills.length >= 1 || titleBonus >= 10)
  ) {
    tier = "green";
    matchReason = matchedSkills.length > 0
      ? `Potential Match (${rawTotal}% match)! Matches skills: ${matchedSkills.join(", ")}. Solid application opportunity.`
      : `Potential Match (${rawTotal}% match)! Relevant role and experience criteria.`;
  }

  return {
    score: rawTotal,
    tier,
    matchedSkills,
    missingSkills,
    experienceFit,
    matchReason
  };
}

export function generatePersonalizedPitch(job: Job, profile: UserProfile, match: JobMatchResult): string {
  const topSkills = match.matchedSkills.length > 0 ? match.matchedSkills.slice(0, 3).join(", ") : (profile.skills || []).slice(0, 3).join(", ");
  const company = job.company || "your team";
  const title = job.title || "this role";
  const candidateName = profile.name || "Candidate";

  return `Hi ${company} Hiring Team,\n\nI came across the ${title} position and am excited to apply. With ${profile.experienceYears}+ years of hands-on experience specializing in ${topSkills || "modern software engineering"}, I believe my skill set aligns strongly with what you are looking for.\n\nI would welcome the opportunity to connect and discuss how I can contribute to ${company}'s goals.\n\nBest regards,\n${candidateName}`;
}
