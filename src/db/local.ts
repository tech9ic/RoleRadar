import { openDB } from "idb";
import type { Application, UserProfile } from "../types/job";

const DB_NAME = "roleradar-local";
const LEGACY_DB_NAME = "job-intelligence-local";
const DB_VERSION = 1;

async function initDB() {
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("bookmarks")) db.createObjectStore("bookmarks");
      if (!db.objectStoreNames.contains("applications")) db.createObjectStore("applications", { keyPath: "id" });
      if (!db.objectStoreNames.contains("preferences")) db.createObjectStore("preferences");
    }
  });

  // Seamless one-time migration from legacy DB if present
  try {
    const existingBookmarks = await db.get("bookmarks", "ids");
    const existingApps = await db.getAll("applications");
    if ((!existingBookmarks || existingBookmarks.length === 0) && (!existingApps || existingApps.length === 0)) {
      if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
        const dbs = await indexedDB.databases();
        const hasLegacy = dbs.some(d => d.name === LEGACY_DB_NAME);
        if (hasLegacy) {
          const oldDb = await openDB(LEGACY_DB_NAME, 1);
          if (oldDb.objectStoreNames.contains("bookmarks")) {
            const oldBookmarks = await oldDb.get("bookmarks", "ids");
            if (oldBookmarks?.length) await db.put("bookmarks", oldBookmarks, "ids");
          }
          if (oldDb.objectStoreNames.contains("applications")) {
            const oldApps = await oldDb.getAll("applications");
            if (oldApps?.length) {
              const tx = db.transaction("applications", "readwrite");
              for (const app of oldApps) await tx.objectStore("applications").put(app);
              await tx.done;
            }
          }
          oldDb.close();
        }
      }
    }
  } catch (err) {
    // Non-critical migration fallback
    console.debug("Legacy DB migration skipped", err);
  }

  return db;
}

const dbPromise = initDB();

export async function getBookmarks(): Promise<string[]> {
  return (await (await dbPromise).get("bookmarks", "ids")) ?? [];
}
export async function saveBookmarks(ids: string[]) {
  return (await dbPromise).put("bookmarks", ids, "ids");
}
export async function getApplications(): Promise<Application[]> {
  return (await dbPromise).getAll("applications");
}
export async function saveApplication(application: Application) {
  return (await dbPromise).put("applications", application);
}
export async function deleteApplication(id: string) {
  return (await dbPromise).delete("applications", id);
}

const DEFAULT_PROFILE: UserProfile = {
  name: "Candidate",
  title: "Software Engineer",
  experienceYears: 1,
  skills: ["React", "TypeScript", "Python", "SQL"],
  targetDepartment: "All departments",
  preferredWorkMode: "Any"
};

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const db = await dbPromise;
    const profile = await db.get("preferences", "user-profile");
    if (profile) return profile;
  } catch {}
  const local = localStorage.getItem("roleradar-user-profile");
  if (local) {
    try { return JSON.parse(local); } catch {}
  }
  return DEFAULT_PROFILE;
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    const db = await dbPromise;
    await db.put("preferences", profile, "user-profile");
  } catch {}
  localStorage.setItem("roleradar-user-profile", JSON.stringify(profile));
}

export async function exportLocalData() {
  const db = await dbPromise;
  const profile = await getUserProfile();
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    bookmarks: await db.get("bookmarks", "ids") ?? [],
    applications: await db.getAll("applications"),
    profile
  };
}

export async function importLocalData(data: { bookmarks?: string[]; applications?: Application[]; profile?: UserProfile }) {
  const db = await dbPromise;
  const tx = db.transaction(["bookmarks", "applications", "preferences"], "readwrite");
  if (data.bookmarks) await tx.objectStore("bookmarks").put(data.bookmarks, "ids");
  if (data.applications) {
    for (const app of data.applications) await tx.objectStore("applications").put(app);
  }
  if (data.profile) {
    await tx.objectStore("preferences").put(data.profile, "user-profile");
    localStorage.setItem("roleradar-user-profile", JSON.stringify(data.profile));
  }
  await tx.done;
}