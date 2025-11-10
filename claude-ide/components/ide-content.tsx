export function IDEContent() {
  return (
    <main className="flex-1 overflow-hidden">
      <div className="h-full w-full">
        {/* 3-Panel Layout Placeholder */}
        <div className="flex h-full w-full items-center justify-center bg-muted/30">
          <div className="max-w-2xl space-y-6 text-center px-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Claude IDE
              </h1>
              <p className="text-lg text-muted-foreground">
                Multi-Agent Development Environment
              </p>
            </div>

            <div className="grid gap-4 text-left sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-card-foreground">Projects</h3>
                <p className="text-sm text-muted-foreground">
                  View and manage multiple agents grouped by project
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-card-foreground">Activity</h3>
                <p className="text-sm text-muted-foreground">
                  Monitor real-time agent actions and events
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                <h3 className="font-semibold text-card-foreground">Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Start new agents and orchestrate tasks
                </p>
              </div>
            </div>

            <div className="pt-4">
              <div className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium text-primary">
                  Ready for Implementation
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
