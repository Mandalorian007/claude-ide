"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProjectsList } from "@/components/projects-list";
import { ActivityViewer } from "@/components/activity-viewer";
import { AgentChat } from "@/components/agent-chat";

export default function Home() {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel - Projects & Agents */}
          <div className="border-r border-border bg-muted/30 lg:col-span-3 h-full overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="border-b border-border p-4 flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Projects & Agents</h2>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <ProjectsList
                  selectedAgentId={selectedAgentId}
                  onAgentSelect={setSelectedAgentId}
                />
              </div>
            </div>
          </div>

          {/* Middle Panel - Activity Viewer */}
          <div className="border-r border-border bg-background lg:col-span-5 hidden lg:block h-full overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="border-b border-border p-4 flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Activity</h2>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <ActivityViewer
                  selectedAgentId={selectedAgentId}
                  onAgentSelect={setSelectedAgentId}
                />
              </div>
            </div>
          </div>

          {/* Right Panel - Agent Chat */}
          <div className="bg-background lg:col-span-4 h-full overflow-hidden">
            <div className="h-full flex flex-col">
              <div className="border-b border-border p-4 flex-shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Orchestrator</h2>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
                <AgentChat />
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
