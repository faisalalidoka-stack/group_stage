export type RegistrationLink = {
  id: string;
  tournament_id: string;
  team_id: string;
  token: string;
  expires_at: string;
  max_submissions: number | null;
  revoked_at: string | null;
  created_at: string;
};

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type Submission = {
  id: string;
  link_id: string | null;
  tournament_id: string;
  team_id: string;
  name: string;
  number: number;
  photo_url: string | null;
  submitted_by: string | null;
  status: SubmissionStatus;
  submitted_at: string;
  reviewed_at: string | null;
};

export type LinkState = "active" | "expired" | "revoked" | "full";

/** Submissions that still use up one of the link's player slots. */
export function slotsUsed(
  link: RegistrationLink,
  submissions: Submission[]
) {
  return submissions.filter(
    (s) => s.link_id === link.id && s.status !== "REJECTED"
  ).length;
}

export function linkState(
  link: RegistrationLink,
  used: number,
  now = Date.now()
): LinkState {
  if (link.revoked_at) return "revoked";
  if (new Date(link.expires_at).getTime() <= now) return "expired";
  if (link.max_submissions !== null && used >= link.max_submissions) {
    return "full";
  }
  return "active";
}

export function registrationUrl(token: string, origin: string) {
  return `${origin}/register/${token}`;
}

export const VALIDITY_OPTIONS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "14 days", hours: 336 },
  { label: "30 days", hours: 720 },
];
