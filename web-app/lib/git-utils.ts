import { exec } from "child_process";
import { promisify } from "util";
import { Repository } from "./types";
import { randomBytes } from "crypto";

const execAsync = promisify(exec);

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Parse git repository information from a local path
 */
export async function parseGitRepository(
  localPath: string
): Promise<Repository | null> {
  try {
    // Check if it's a git repository
    await execAsync("git rev-parse --git-dir", { cwd: localPath });

    // Get current branch
    const { stdout: branch } = await execAsync(
      "git branch --show-current",
      { cwd: localPath }
    );

    // Get remote URL (if exists)
    let remoteUrl: string | undefined;
    let owner = "local";
    let name = localPath.split("/").pop() || "unknown";

    try {
      const { stdout: remote } = await execAsync("git remote get-url origin", {
        cwd: localPath,
      });
      remoteUrl = remote.trim();

      // Parse owner/name from remote URL
      // Supports: https://github.com/owner/repo.git and git@github.com:owner/repo.git
      const match = remoteUrl.match(
        /(?:github\.com[:/])(.+?)\/(.+?)(?:\.git)?$/
      );
      if (match) {
        owner = match[1];
        name = match[2];
      }
    } catch {
      // No remote configured, use local info
    }

    return {
      id: generateId(),
      owner,
      name,
      fullName: `${owner}/${name}`,
      localPath,
      branch: branch.trim() || "main",
      remoteUrl,
      sessions: [],
    };
  } catch (error) {
    // Not a git repository
    return null;
  }
}

/**
 * Check if a path is a git repository
 */
export async function isGitRepository(path: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --git-dir", { cwd: path });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the root of the git repository containing the given path
 */
export async function getGitRoot(path: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --show-toplevel", {
      cwd: path,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get current git branch
 */
export async function getCurrentBranch(path: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git branch --show-current", {
      cwd: path,
    });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Extract title from prompt (first sentence or first 50 chars)
 */
export function extractTitle(prompt: string): string {
  // Try to get first sentence
  const firstSentence = prompt.match(/^[^.!?]+[.!?]/);
  if (firstSentence) {
    return firstSentence[0].trim();
  }

  // Otherwise take first 50 chars
  if (prompt.length <= 50) {
    return prompt;
  }

  return prompt.substring(0, 47) + "...";
}
