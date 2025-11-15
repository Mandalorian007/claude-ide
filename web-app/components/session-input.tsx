"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { startSession, getGitHubRepos, checkGitHub } from "@/app/actions";
import { Loader2, AlertCircle, RefreshCw, ChevronsUpDown, Check } from "lucide-react";
import { GitHubRepo } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SessionInputProps {
  onSessionCreated?: (sessionId: string) => void;
}

export function SessionInput({ onSessionCreated }: SessionInputProps = {}) {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ghStatus, setGhStatus] = useState<{ installed: boolean; authenticated: boolean } | null>(
    null
  );

  // Load GitHub repos on mount
  useEffect(() => {
    loadGitHubRepos();
    checkGitHubStatus();
  }, []);

  const checkGitHubStatus = async () => {
    const status = await checkGitHub();
    setGhStatus(status);
  };

  const loadGitHubRepos = async () => {
    setIsLoadingRepos(true);
    setError(null);

    try {
      const repoList = await getGitHubRepos();
      setRepos(repoList);

      // Auto-select first repo if available
      if (repoList.length > 0 && !selectedRepo) {
        setSelectedRepo(repoList[0].fullName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load repositories");
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Please enter a task description");
      return;
    }

    if (!selectedRepo) {
      setError("Please select a repository");
      return;
    }

    setIsLoading(true);

    try {
      // Get default branch from selected repo
      const repo = repos.find((r) => r.fullName === selectedRepo);
      const defaultBranch = repo?.defaultBranch || "main";

      const result = await startSession(selectedRepo, prompt, defaultBranch);

      if (result.success) {
        // Clear prompt on success
        setPrompt("");

        // Notify parent component of new session
        if (result.sessionId && onSessionCreated) {
          onSessionCreated(result.sessionId);
        }
      } else {
        setError(result.error || "Failed to start session");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  // Show GitHub CLI error if not ready
  if (ghStatus && (!ghStatus.installed || !ghStatus.authenticated)) {
    return (
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="p-6">
          <div className="flex items-start gap-3 rounded-md bg-destructive/10 p-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-destructive">GitHub CLI Required</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {!ghStatus.installed
                  ? "GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/"
                  : "GitHub CLI is not authenticated. Please run 'gh auth login' in your terminal."}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="repo-select" className="text-sm text-muted-foreground">
                GitHub Repository
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadGitHubRepos}
                disabled={isLoadingRepos}
                className="h-auto p-1"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingRepos ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {isLoadingRepos ? (
              <div className="flex items-center justify-center p-4 border rounded-md bg-muted/30">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm text-muted-foreground">Loading repositories...</span>
              </div>
            ) : repos.length === 0 ? (
              <div className="flex items-center justify-center p-4 border rounded-md bg-muted/30">
                <AlertCircle className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">No repositories found</span>
              </div>
            ) : (
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-mono text-sm"
                    disabled={isLoading}
                  >
                    {selectedRepo || "Select repository..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search repositories..." />
                    <CommandList>
                      <CommandEmpty>No repository found.</CommandEmpty>
                      <CommandGroup>
                        {repos.map((repo) => (
                          <CommandItem
                            key={repo.fullName}
                            value={repo.fullName}
                            onSelect={(currentValue) => {
                              setSelectedRepo(currentValue === selectedRepo ? "" : currentValue);
                              setOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedRepo === repo.fullName ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <span className="font-mono text-sm">{repo.fullName}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Task Input */}
          <div className="space-y-2">
            <Label htmlFor="task-input" className="text-sm text-muted-foreground">
              What should I work on?
            </Label>
            <Textarea
              id="task-input"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Refactor the authentication system to use JWT tokens..."
              className="min-h-[100px] resize-none"
              disabled={isLoading || repos.length === 0}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !prompt.trim() || !selectedRepo || repos.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Workspace & Starting Session...
              </>
            ) : (
              "Start New Session"
            )}
          </Button>
        </form>

        {/* Info */}
        <p className="mt-4 text-xs text-muted-foreground">
          Each session creates an isolated workspace with a fresh clone from the repository's main
          branch. The session will work on a dedicated branch that can be turned into a PR.
        </p>
      </div>
    </div>
  );
}
