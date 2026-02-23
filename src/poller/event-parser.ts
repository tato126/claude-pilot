import type { TriggerConfig } from "../types/config.js";
import type { PilotEvent, GitHubComment } from "../types/events.js";
import type { EventType } from "../types/events.js";

const BOT_SIGNATURE = "<!-- claude-pilot -->";

export function parseComment(
  comment: GitHubComment,
  repo: string,
  issueNumber: number,
  triggers: TriggerConfig,
  allowedAuthors: string[]
): PilotEvent | null {
  // 1. Skip if comment body contains BOT_SIGNATURE (self-loop prevention)
  if (comment.body.includes(BOT_SIGNATURE)) {
    return null;
  }

  // 2. Skip if comment author is not in allowedAuthors
  if (!allowedAuthors.includes(comment.user.login)) {
    return null;
  }

  const body = comment.body.toLowerCase();
  let eventType: EventType | null = null;

  // 3. Check for trigger keywords (order matters: approve/reject/abort before mention)
  if (body.includes(triggers.approve.toLowerCase())) {
    eventType = "approve";
  } else if (body.includes(triggers.reject.toLowerCase())) {
    eventType = "reject";
  } else if (body.includes(triggers.abort.toLowerCase())) {
    eventType = "abort";
  } else if (body.includes(triggers.mention.toLowerCase())) {
    eventType = "mention";
  } else {
    // Not a trigger comment
    return null;
  }

  return {
    type: eventType,
    repo,
    issue_number: issueNumber,
    comment_id: comment.id,
    author: comment.user.login,
    body: comment.body,
    created_at: comment.created_at,
  };
}
