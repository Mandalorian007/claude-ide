import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { GitHubRepo } from "./types";

const execAsync = promisify(exec);

/**
 * Get the workspace directory
 * Always uses .claude-workspaces in the project root
 */
export function getWorkspaceDir(): string {
  // Use .claude-workspaces in the project root (one level up from web-app/)
  // This allows nested git repos while sharing .claude/ configuration
  return path.join(process.cwd(), '..', '.claude-workspaces');
}

/**
 * Generate a unique workspace directory name
 * Format: {repo-name}-{uuid8}
 */
export function generateWorkspaceName(repoName: string): string {
  const uuid8 = randomUUID().split("-")[0]; // First 8 characters
  return `${repoName}-${uuid8}`;
}

/**
 * Generate a branch name for a session
 * Format: claude/{title-slug} or claude/session-{uuid8}
 */
export function generateBranchName(title: string): string {
  // Slugify title: lowercase, replace spaces/special chars with hyphens
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50);

  if (slug) {
    return `claude/${slug}`;
  }

  // Fallback to UUID-based name
  const uuid8 = randomUUID().split("-")[0];
  return `claude/session-${uuid8}`;
}

/**
 * Check if GitHub CLI is installed and authenticated
 */
export async function checkGitHubCLI(): Promise<{ installed: boolean; authenticated: boolean; error?: string }> {
  try {
    // Check if gh is installed
    await execAsync("gh --version");

    // Check if authenticated
    const { stdout } = await execAsync("gh auth status");
    const authenticated = stdout.includes("Logged in") || stdout.includes("✓");

    return { installed: true, authenticated };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If command not found, gh not installed
    if (errorMessage.includes("command not found") || errorMessage.includes("not recognized")) {
      return { installed: false, authenticated: false, error: "GitHub CLI not installed" };
    }

    // If gh installed but not authenticated
    return { installed: true, authenticated: false, error: "Not authenticated with GitHub CLI" };
  }
}

/**
 * List user's GitHub repositories
 */
export async function listGitHubRepos(limit: number = 100): Promise<GitHubRepo[]> {
  try {
    const { stdout } = await execAsync(
      `gh repo list --json name,owner,url,defaultBranchRef --limit ${limit}`
    );

    const repos = JSON.parse(stdout);

    return repos.map((repo: any) => ({
      owner: repo.owner.login,
      name: repo.name,
      fullName: `${repo.owner.login}/${repo.name}`,
      url: repo.url,
      defaultBranch: repo.defaultBranchRef?.name || "main",
    }));
  } catch (error) {
    console.error("Failed to list GitHub repos:", error);
    throw new Error("Failed to list repositories. Make sure GitHub CLI is installed and authenticated.");
  }
}

/**
 * Create a workspace: clone repo and create branch
 */
export async function createWorkspace(
  githubRepo: string,
  sessionTitle: string,
  defaultBranch: string = "main"
): Promise<{ workspacePath: string; gitBranch: string }> {
  try {
    // Generate workspace name and path
    const repoName = githubRepo.split("/")[1];
    const workspaceName = generateWorkspaceName(repoName);
    const workspaceDir = getWorkspaceDir();
    const workspacePath = path.join(workspaceDir, workspaceName);

    // Ensure workspace directory exists
    await fs.mkdir(workspaceDir, { recursive: true });

    // Clone repository
    console.log(`Cloning ${githubRepo} to ${workspacePath}...`);
    await execAsync(`gh repo clone ${githubRepo} "${workspacePath}"`);

    // Generate branch name
    const gitBranch = generateBranchName(sessionTitle);

    // Create and checkout new branch
    console.log(`Creating branch ${gitBranch}...`);
    await execAsync(`git checkout -b ${gitBranch}`, { cwd: workspacePath });

    console.log(`Workspace created: ${workspacePath}`);

    return { workspacePath, gitBranch };
  } catch (error) {
    console.error("Failed to create workspace:", error);
    throw new Error(`Failed to create workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Clean up workspace: delete directory
 */
export async function cleanupWorkspace(workspacePath: string): Promise<void> {
  try {
    console.log(`Cleaning up workspace: ${workspacePath}`);

    // Verify path is within workspace directory (safety check)
    const workspaceDir = getWorkspaceDir();
    if (!workspacePath.startsWith(workspaceDir)) {
      throw new Error("Workspace path is not within the configured workspace directory");
    }

    // Delete the directory
    await fs.rm(workspacePath, { recursive: true, force: true });

    console.log(`Workspace deleted: ${workspacePath}`);
  } catch (error) {
    console.error("Failed to cleanup workspace:", error);
    throw new Error(`Failed to cleanup workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Push branch to remote
 */
export async function pushBranch(workspacePath: string, branchName: string): Promise<void> {
  try {
    console.log(`Pushing branch ${branchName} from ${workspacePath}...`);
    await execAsync(`git push -u origin ${branchName}`, { cwd: workspacePath });
    console.log(`Branch pushed: ${branchName}`);
  } catch (error) {
    console.error("Failed to push branch:", error);
    throw new Error(`Failed to push branch: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a pull request from the session branch
 */
export async function createPullRequest(
  workspacePath: string,
  branchName: string,
  title: string,
  body: string
): Promise<string> {
  try {
    console.log(`Creating PR from branch ${branchName}...`);

    // First, push the branch if needed
    try {
      await pushBranch(workspacePath, branchName);
    } catch (error) {
      // Branch might already be pushed, continue
      console.log("Branch may already be pushed, continuing...");
    }

    // Create PR using gh CLI
    const { stdout } = await execAsync(
      `gh pr create --title "${title}" --body "${body}" --head ${branchName}`,
      { cwd: workspacePath }
    );

    // Extract PR URL from output
    const prUrl = stdout.trim().split("\n").pop() || "";

    console.log(`PR created: ${prUrl}`);
    return prUrl;
  } catch (error) {
    console.error("Failed to create PR:", error);
    throw new Error(`Failed to create pull request: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if workspace exists
 */
export async function workspaceExists(workspacePath: string): Promise<boolean> {
  try {
    await fs.access(workspacePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get workspace info (for debugging/display)
 */
export async function getWorkspaceInfo(workspacePath: string): Promise<{
  exists: boolean;
  branch?: string;
  hasChanges?: boolean;
  commitCount?: number;
}> {
  try {
    const exists = await workspaceExists(workspacePath);
    if (!exists) {
      return { exists: false };
    }

    // Get current branch
    const { stdout: branchOutput } = await execAsync("git rev-parse --abbrev-ref HEAD", {
      cwd: workspacePath,
    });
    const branch = branchOutput.trim();

    // Check for uncommitted changes
    const { stdout: statusOutput } = await execAsync("git status --porcelain", {
      cwd: workspacePath,
    });
    const hasChanges = statusOutput.trim().length > 0;

    // Count commits on this branch
    const { stdout: countOutput } = await execAsync(
      "git rev-list --count HEAD ^origin/HEAD 2>/dev/null || echo 0",
      { cwd: workspacePath }
    );
    const commitCount = parseInt(countOutput.trim(), 10);

    return {
      exists: true,
      branch,
      hasChanges,
      commitCount,
    };
  } catch (error) {
    console.error("Failed to get workspace info:", error);
    return { exists: false };
  }
}
