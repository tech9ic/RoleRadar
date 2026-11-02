import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as XLSX from "xlsx";

type AnyRow = Record<string, unknown>;
const DATA_DIR = path.resolve("data");
const OUT_DIR = path.resolve("public/generated");
const aliases: Record<string,string[]> = {
  title:["title","job title","position","role"],
  company:["company","employer","organization"],
  department:["department","category","job category"],
  level:["level","job level"],
  seniorityTag:["seniority tag","seniority","seniority level"],
  experience:["experience","required experience","years of experience"],
  employmentType:["employment type","job type","type"],
  workMode:["work mode","workplace type","work arrangement"],
  location:["location","job location","city"],
  market:["market","region"],
  salary:["salary","compensation"],
  companyType:["company type","organization type"],
  skills:["skills","required skills","technologies"],
  postedOn:["posted on","posted date","date posted"],
  freshness:["freshness","age"],
  applyUrl:["apply","application link","apply url","url","link"]
};
const norm = (s:string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g," ").trim();
const str = (v:unknown):string|null => {
  if(v===null||v===undefined||v==="") return null;
  if(v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0,10);
  const s=String(v).trim(); return s || null;
};
function filesUnder(dir:string):string[] {
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) return filesUnder(full);
    return entry.isFile() && /\.xlsx$/i.test(entry.name) && !entry.name.startsWith("~$") ? [full] : [];
  }).sort();
}
function stableId(value:string){return crypto.createHash("sha1").update(value).digest("hex").slice(0,16);}
function cleanUrl(value:string|null) {
  if(!value) return null;
  try { const u=new URL(value); ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","gclid","fbclid"].forEach(k=>u.searchParams.delete(k)); return u.toString().replace(/\/$/,"").toLowerCase(); }
  catch { return value.trim().toLowerCase(); }
}
function cellLink(sheet:XLSX.WorkSheet,row:number,col:number) {
  const address=XLSX.utils.encode_cell({r:row,c:col});
  return sheet[address]?.l?.Target ?? null;
}
const discovered=filesUnder(DATA_DIR);
const merged=new Map<string,AnyRow>();
const sheetCounts:Record<string,number>={};
const processedFiles:string[]=[];
const failedFiles:{name:string,error:string}[]=[];
let rawRecords=0,invalidRows=0,worksheetsProcessed=0;

for(const file of discovered) {
  try {
    const workbook=XLSX.readFile(file,{cellDates:true});
    processedFiles.push(path.relative(DATA_DIR,file).replace(/\\/g,"/"));
    for(const sheetName of workbook.SheetNames) {
      if(sheetName.trim().toLowerCase()==="summary") continue;
      const sheet=workbook.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json<AnyRow>(sheet,{defval:null,raw:true});
      if(!rows.length) continue;
      const headers=Object.keys(rows[0]).map(norm);
      if(!headers.some(h=>aliases.title.includes(h))) continue;
      worksheetsProcessed++;
      sheetCounts[sheetName]=(sheetCounts[sheetName]||0)+0;
      const originalHeaders=Object.keys(rows[0]);
      for(let idx=0;idx<rows.length;idx++) {
        const row=rows[idx]; rawRecords++;
        const normalized=new Map(Object.entries(row).map(([k,v])=>[norm(k),v]));
        const get=(field:string)=> {
          for(const alias of aliases[field]) if(normalized.has(alias)) return normalized.get(alias);
          return null;
        };
        const title=str(get("title")), company=str(get("company"));
        if(!title||!company){invalidRows++;continue;}
        const source=path.relative(DATA_DIR,file).replace(/\\/g,"/");
        const excelRow=idx+1;
        const applyIndex=originalHeaders.findIndex(h=>aliases.applyUrl.includes(norm(h)));
        const applyValue=str(get("applyUrl"));
        const applyUrl=(applyValue && /^https?:\/\//i.test(applyValue)) ? applyValue : (applyIndex>=0?cellLink(sheet,excelRow,applyIndex):null);
        const postedRaw=get("postedOn");
        const posted=str(postedRaw);
        const skills=str(get("skills"))?.split(/[,;|]/).map(x=>x.trim().toLowerCase()).filter(Boolean)??[];
        const location=str(get("location"));
        const keyUrl=cleanUrl(applyUrl);
        const fallback=[title,company,location||"",posted||""].map(x=>String(x).toLowerCase().trim()).join("|");
        const key=keyUrl?`url:${keyUrl}`:`fallback:${fallback}|${source}|${sheetName}|${idx}`;
        const id=stableId(keyUrl?`url:${keyUrl}`:fallback);
        const job:AnyRow={
          id,title,company,department:str(get("department")),level:str(get("level")),
          seniorityTag:str(get("seniorityTag")),experience:str(get("experience")),
          employmentType:str(get("employmentType")),workMode:str(get("workMode")),
          location,market:str(get("market")),salary:str(get("salary")),
          companyType:str(get("companyType")),skills,postedOn:posted,freshness:str(get("freshness")),
          applyUrl,sourceFiles:[path.basename(file)],sourceSheets:[sheetName]
        };
        if(merged.has(key)) {
          const old=merged.get(key)!;
          old.sourceFiles=Array.from(new Set([...(old.sourceFiles as string[]),path.basename(file)]));
          old.sourceSheets=Array.from(new Set([...(old.sourceSheets as string[]),sheetName]));
          for(const [k,v] of Object.entries(job)) if(!["id","sourceFiles","sourceSheets","skills"].includes(k)&&!old[k]&&v) old[k]=v;
          old.skills=Array.from(new Set([...(old.skills as string[]),...skills]));
        } else merged.set(key,job);
        sheetCounts[sheetName]++;
      }
    }
  } catch(error) { failedFiles.push({name:path.relative(DATA_DIR,file),error:String(error)}); }
}
const jobs: AnyRow[]=[...merged.values()].map((job): AnyRow=>({
  ...job,
  searchText:[job.title,job.company,job.department,job.level,job.experience,job.workMode,job.location,...(job.skills as string[])].filter(Boolean).join(" ").toLowerCase()
})).sort((a,b)=>String(b.postedOn||"").localeCompare(String(a.postedOn||"")));
const unique=(key:string)=>Array.from(new Set(jobs.map(j=>j[key]).filter(Boolean) as string[])).sort();
const generatedAt=new Date().toISOString();
const metadata={
  generatedAt,sourceFiles:processedFiles,rawRecords,uniqueJobs:jobs.length,
  duplicatesRemoved:rawRecords-invalidRows-jobs.length,invalidRows,
  workbooksProcessed:processedFiles.length,worksheetsProcessed,
  departments:unique("department"),locations:unique("location"),companies:unique("company"),
  workModes:unique("workMode"),employmentTypes:unique("employmentType"),levels:unique("level"),sheetCounts
};
const report={generatedAt,files:processedFiles.map(name=>({name,status:"processed"})).concat(failedFiles.map(f=>({...f,status:"failed"}))),worksheetsProcessed,rawRecords,uniqueJobs:jobs.length,duplicatesRemoved:metadata.duplicatesRemoved,invalidRows,warnings:failedFiles};
if(failedFiles.length && !jobs.length) throw new Error("All workbooks failed; refusing to publish an empty dataset.");
fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,"jobs.json"),JSON.stringify(jobs));
fs.writeFileSync(path.join(OUT_DIR,"metadata.json"),JSON.stringify(metadata,null,2));
fs.writeFileSync(path.join(OUT_DIR,"ingestion-report.json"),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(OUT_DIR,"manifest.json"),JSON.stringify({version:1,generatedAt,jobs:"/generated/jobs.json",metadata:"/generated/metadata.json",report:"/generated/ingestion-report.json",rawRecords,uniqueJobs:jobs.length},null,2));
console.log(`Processed ${processedFiles.length} workbooks, ${worksheetsProcessed} worksheets, ${rawRecords} raw rows → ${jobs.length} unique jobs.`);
if(failedFiles.length) console.warn(`${failedFiles.length} workbook(s) failed. See ingestion-report.json.`);
