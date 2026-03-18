// types/ready-roster.ts

export type TeamBranding = {
  teamId?: number | null;
  teamName?: string | null;
  coachName?: string | null;
  logoPath?: string | null;
};

export type MatchBase = {
  id: number;
  eventName?: string | null;
  ageGroup?: string | null;
  weightClass?: string | null;
  status?: string | null;
  matchedOn?: string | null;
};

export type AthleteInfo = {
  athleteId?: number | null;
  athleteName?: string | null;
};

export type MatchRow = TeamBranding & MatchBase & AthleteInfo;

export type AthleteViewRow = TeamBranding &
  MatchBase & {
    athleteId?: number | null;
    athleteName?: string | null;
  };

export type DashboardRow = TeamBranding &
  MatchBase & {
    athleteId?: number | null;
    athleteName?: string | null;
  };

export type TeamSummaryRow = TeamBranding & {
  city?: string | null;
  state?: string | null;
  contactEmail?: string | null;
};