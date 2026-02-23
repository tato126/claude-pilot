export type EventType = "mention" | "approve" | "reject" | "abort";

export interface PilotEvent {
  type: EventType;
  repo: string;
  issue_number: number;
  comment_id: number;
  author: string;
  body: string;
  created_at: string;
}

export interface GitHubComment {
  id: number;
  body: string;
  user: {
    login: string;
  };
  created_at: string;
  html_url: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
  labels: Array<{ name: string }>;
  state: string;
}
