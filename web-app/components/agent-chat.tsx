"use client";

import { useState } from "react";
import { startAgent } from "@/app/actions";
import { Send, Loader2 } from "lucide-react";

const DEFAULT_PROJECT_PATH = "/Users/matthew/IdeaProjects/claude-ide";

export function AgentChat() {
  const [prompt, setPrompt] = useState("");
  const [projectPath, setProjectPath] = useState(DEFAULT_PROJECT_PATH);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!prompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const result = await startAgent(projectPath, prompt.trim());

      if (result.success) {
        setPrompt("");
        setError(null);
      } else {
        setError(result.error || "Failed to start agent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Start New Agent</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new agent to work on your project
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="project-path">
                Project Path
              </label>
              <input
                id="project-path"
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                placeholder="/path/to/project"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="prompt">
                Task Description
              </label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 resize-none"
                placeholder="What should the agent work on?"
                rows={8}
                disabled={isStarting}
              />
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={isStarting || !prompt.trim()}
            className="w-full inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStarting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Agent...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Start Agent
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>Model: Claude Sonnet 4.5</p>
        </div>
      </div>
    </div>
  );
}
