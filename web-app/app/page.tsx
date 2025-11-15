"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SessionInput } from "@/components/session-input";
import { SessionsList } from "@/components/sessions-list";
import { ConversationView } from "@/components/conversation-view";

export default function Home() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const handleSessionCreated = (sessionId: string) => {
    console.log(`[UI] New session created: ${sessionId}`);
    // Auto-select the newly created session
    setSelectedSessionId(sessionId);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel - Session Input & Sessions List */}
          <div className="border-r border-border bg-muted/30 lg:col-span-3 h-full overflow-hidden flex flex-col">
            <SessionInput onSessionCreated={handleSessionCreated} />
            <div className="flex-1 overflow-hidden">
              <SessionsList onSessionSelect={setSelectedSessionId} />
            </div>
          </div>

          {/* Right Panel - Conversation View */}
          <div className="bg-background lg:col-span-9 h-full overflow-hidden">
            <ConversationView sessionId={selectedSessionId} />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
