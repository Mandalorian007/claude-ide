export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container flex h-12 max-w-full items-center justify-between px-4 text-sm text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>Powered by Claude Agent SDK</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="hidden sm:inline">Ready</span>
          <div className="flex items-center space-x-1">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs">Connected</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
