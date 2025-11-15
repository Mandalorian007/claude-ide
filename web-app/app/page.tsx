"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { SessionInput } from "@/components/session-input";
import { SessionsList } from "@/components/sessions-list";
import { ConversationView } from "@/components/conversation-view";

export default function Home() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      {/* Session Input - Top Bar */}
      <SessionInput />

      <main className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel - Sessions List */}
          <div className="border-r border-border bg-muted/30 lg:col-span-3 h-full overflow-hidden">
            <SessionsList onSessionSelect={setSelectedSessionId} />
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
