"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startSession } from "@/app/actions";
import { Loader2 } from "lucide-react";

export function SessionInput() {
  const [repositoryPath, setRepositoryPath] = useState(process.cwd());
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!prompt.trim()) {
      setError("Please enter a task description");
      return;
    }

    if (!repositoryPath.trim()) {
      setError("Please enter a repository path");
      return;
    }

    setIsLoading(true);

    try {
      const result = await startSession(repositoryPath, prompt);

      if (result.success) {
        // Clear prompt on success
        setPrompt("");
      } else {
        setError(result.error || "Failed to start session");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Repository Path */}
          <div className="space-y-2">
            <Label htmlFor="repo-path" className="text-sm text-muted-foreground">
              Repository Path
            </Label>
            <Input
              id="repo-path"
              type="text"
              value={repositoryPath}
              onChange={(e) => setRepositoryPath(e.target.value)}
              placeholder="/path/to/your/repository"
              className="font-mono text-sm"
              disabled={isLoading}
            />
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
              disabled={isLoading}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Session...
              </>
            ) : (
              "Start Session"
            )}
          </Button>
        </form>

        {/* Info */}
        <p className="mt-4 text-xs text-muted-foreground">
          Sessions are scoped to Git repositories. The main session can spawn
          sub-agents (test-runner, code-reviewer, etc.) for specialized tasks.
        </p>
      </div>
    </div>
  );
}
