import { NextRequest } from "next/server";
import { sessionRepository } from "@/lib/session-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream session updates via Server-Sent Events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  console.log(`[SSE] Starting stream for session: ${sessionId}`);

  // Debug: log all available sessions
  const allSessions = sessionRepository.getAllSessions();
  console.log(`[SSE] Available sessions: ${allSessions.map(s => s.id).join(', ') || 'none'}`);
  console.log(`[SSE] Total sessions in repository: ${allSessions.length}`);

  const encoder = new TextEncoder();
  let lastMessageCount = 0;
  let intervalId: NodeJS.Timeout | null = null;
  let heartbeatId: NodeJS.Timeout | null = null;
  let completionSent = false;

  const stream = new ReadableStream({
    start(controller) {
      console.log(`[SSE] Stream started for session: ${sessionId}`);

      // Send initial session state
      const session = sessionRepository.getSession(sessionId);
      if (!session) {
        const availableIds = sessionRepository.getAllSessions().map(s => s.id).join(', ');
        console.error(`[SSE] Session not found: ${sessionId}`);
        console.error(`[SSE] Available session IDs: ${availableIds || 'none'}`);
        const errorData = `data: ${JSON.stringify({
          type: "error",
          error: "Session not found",
          details: `Session ${sessionId} not found. Available: ${availableIds || 'none'}`
        })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
        return;
      }

      console.log(`[SSE] Sending initial state, ${session.messages.length} messages`);
      const data = `data: ${JSON.stringify({ type: "init", session })}\n\n`;
      controller.enqueue(encoder.encode(data));
      lastMessageCount = session.messages.length;

      // Send heartbeat every 15 seconds to keep connection alive
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch (error) {
          console.error("[SSE] Heartbeat error:", error);
          if (heartbeatId) clearInterval(heartbeatId);
        }
      }, 15000);

      // Poll for updates and stream them
      intervalId = setInterval(() => {
        try {
          const session = sessionRepository.getSession(sessionId);

          if (!session) {
            console.log(`[SSE] Session ended or not found: ${sessionId}`);
            controller.close();
            if (intervalId) clearInterval(intervalId);
            return;
          }

          // Check if there are new messages
          if (session.messages.length > lastMessageCount) {
            const newMessages = session.messages.slice(lastMessageCount);
            console.log(`[SSE] Sending ${newMessages.length} new messages`);
            lastMessageCount = session.messages.length;

            // Send new messages
            for (const message of newMessages) {
              const data = `data: ${JSON.stringify({
                type: "message",
                message,
                session: {
                  status: session.status,
                  contextUsed: session.contextUsed,
                  totalTokens: session.totalTokens,
                  totalCost: session.totalCost,
                },
              })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }

          // Send completion message but keep polling for potential continuation
          if ((session.status === "completed" || session.status === "error") && !completionSent) {
            console.log(`[SSE] Session finished with status: ${session.status}`);
            const completeData = `data: ${JSON.stringify({
              type: "complete",
              session: {
                status: session.status,
                contextUsed: session.contextUsed,
                totalTokens: session.totalTokens,
                totalCost: session.totalCost,
                sdkSessionId: session.sdkSessionId,
              },
            })}\n\n`;
            controller.enqueue(encoder.encode(completeData));
            completionSent = true;
            // Keep polling - session might be continued
          }

          // Reset completion flag if session becomes active again (continued)
          if (session.status === "active" && completionSent) {
            console.log(`[SSE] Session resumed/continued, will send completion again when done`);
            completionSent = false;
          }
        } catch (error) {
          console.error("[SSE] Error in polling interval:", error);
          controller.close();
          if (intervalId) clearInterval(intervalId);
          if (heartbeatId) clearInterval(heartbeatId);
        }
      }, 500); // Poll every 500ms for smoother updates
    },
    cancel() {
      console.log(`[SSE] Stream cancelled for session: ${sessionId}`);
      if (intervalId) clearInterval(intervalId);
      if (heartbeatId) clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
