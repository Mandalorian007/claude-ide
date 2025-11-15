import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getWorkspaceDir } from "./git-workspace-utils";
import { Session, SubAgent } from "./types";

/**
 * Get the database file path (stored in the same directory as workspaces)
 */
function getDatabasePath(): string {
  const workspaceDir = getWorkspaceDir();
  return path.join(workspaceDir, "sessions.json");
}

/**
 * Ensure the workspace directory exists
 */
async function ensureWorkspaceDir(): Promise<void> {
  const workspaceDir = getWorkspaceDir();
  if (!existsSync(workspaceDir)) {
    await mkdir(workspaceDir, { recursive: true });
  }
}

/**
 * Data structure for JSON storage
 */
interface DatabaseData {
  sessions: Session[];
  subAgents: SubAgent[];
  version: string;
}

/**
 * Check if we're in a build/compile-time environment
 */
function isBuildTime(): boolean {
  return process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME;
}

// ============ Core Persistence ============

/**
 * Load all data from JSON file
 */
export async function loadDatabase(): Promise<DatabaseData> {
  // Skip during build time
  if (isBuildTime()) {
    return { sessions: [], subAgents: [], version: "1.0" };
  }

  const dbPath = getDatabasePath();

  if (!existsSync(dbPath)) {
    return { sessions: [], subAgents: [], version: "1.0" };
  }

  try {
    const json = await readFile(dbPath, "utf-8");
    const data = JSON.parse(json, (key, value) => {
      // Revive Date objects
      if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    });

    return data;
  } catch (error) {
    console.error("Failed to load database:", error);
    return { sessions: [], subAgents: [], version: "1.0" };
  }
}

/**
 * Save all data to JSON file
 */
export async function saveDatabase(data: DatabaseData): Promise<void> {
  // Skip during build time
  if (isBuildTime()) {
    return;
  }

  try {
    await ensureWorkspaceDir();
    const dbPath = getDatabasePath();
    const json = JSON.stringify(data, null, 2);
    await writeFile(dbPath, json, "utf-8");
  } catch (error) {
    console.error("Failed to save database:", error);
    throw error;
  }
}

// ============ Session Persistence ============

/**
 * Load all sessions from database
 */
export function loadAllSessions(): Session[] {
  // This will be called synchronously from the repository constructor
  // We'll handle this differently in the repository
  return [];
}

/**
 * Load all sub-agents for a session
 */
export function loadSubAgentsBySession(sessionId: string): SubAgent[] {
  // This will be handled in the repository
  return [];
}

// ============ No-op functions for compatibility ============
// These maintain API compatibility with the SQLite version
// but actual persistence is handled by saveDatabase/loadDatabase

export function saveSession(session: Session): void {
  // No-op - handled by saveDatabase
}

export function saveSubAgent(subAgent: SubAgent): void {
  // No-op - handled by saveDatabase
}

export function saveSessionMessage(sessionId: string, message: any): void {
  // No-op - messages are part of session object
}

export function saveSubAgentMessage(subAgentId: string, message: any): void {
  // No-op - messages are part of sub-agent object
}

export function deleteSession(id: string): void {
  // No-op - handled by saveDatabase
}

export function deleteSubAgent(id: string): void {
  // No-op - handled by saveDatabase
}

/**
 * Clear all data
 */
export async function clearDatabase(): Promise<void> {
  await saveDatabase({ sessions: [], subAgents: [], version: "1.0" });
}

/**
 * Get database info
 */
export function getDatabaseInfo(): { path: string; exists: boolean } {
  const dbPath = getDatabasePath();
  return {
    path: dbPath,
    exists: existsSync(dbPath),
  };
}
