export type UserRole = 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';

export interface UserRoleRecord {
  event_id: string;
  role: UserRole;
}

export interface User {
  id: string;
  email: string;
  name: string;
  roles: UserRoleRecord[];
  csrf_token: string;
}

export interface Event {
  id: string;
  name: string;
  submissions_close: string;
  judging_close?: string | null;
  starts_at?: string | null;
  description?: string;
}

export interface Track {
  id: string;
  event_id: string;
  name: string;
}

export interface Prize {
  id: string;
  event_id: string;
  track_id?: string | null;
  track_name?: string | null;
  title: string;
  description: string;
  amount: string;
  rank_order: number;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
}

export interface Team {
  id: string;
  event_id: string;
  name: string;
}

export interface TeamDetails {
  team: Team;
  members: TeamMember[];
  projects: Array<{
    id: string;
    title: string;
    state: 'draft' | 'submitted';
    track_id: string;
    submitted_at: string | null;
  }>;
}

export interface Project {
  id: string;
  event_id?: string;
  team_id?: string;
  track_id?: string;
  title: string;
  summary: string;
  repo_url: string;
  demo_url?: string;
  video_url?: string;
  submitted_at: string | null;
  state?: 'draft' | 'submitted';
  team?: string;
  team_name?: string;
  track?: string;
  track_name?: string;
}

export interface GalleryResponse {
  items: Project[];
  page: number;
  limit: number;
  total: number;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
  min_score: number;
  max_score: number;
}

export interface JudgeAssignment {
  judge_id: string;
  project_id: string;
  status: 'pending' | 'completed';
}

export interface JudgeBallot {
  project_id: string;
  title: string;
  comment: string;
  submitted_at: string | null;
  criteria: Record<string, number>;
}

export interface EvaluationFormData {
  event_id: string;
  project: Project;
  rubric: RubricCriterion[];
  evaluation: {
    completed: boolean;
    comment: string;
    scores: Record<string, number>;
    submitted_at: string | null;
  };
}

export interface DashboardProject {
  project_id: string;
  title: string;
  track_id: string;
  assigned: number;
  completed: number;
  pending: number;
}

export interface DashboardJudge {
  judge_id: string;
  name: string;
  assigned: number;
  completed: number;
  pending: number;
}

export interface DashboardData {
  event_id: string;
  completion_percentage: number;
  totals: {
    assigned: number;
    completed: number;
  };
  projects: DashboardProject[];
  judges: DashboardJudge[];
}

export interface NormalizedProjectResult {
  rank: number | null;
  project_id: string;
  title: string;
  team_id: string;
  team_name: string;
  track_id: string;
  track_name: string;
  review_count: number;
  raw_percent: number | null;
  normalized_percent: number | null;
}

export interface ResultsData {
  event_id: string;
  method: string;
  global_mean_percent: number;
  total_evaluations: number;
  projects: NormalizedProjectResult[];
}

export interface HackathonItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  prizePool: string;
  status: 'active' | 'judging' | 'upcoming' | 'closed';
  statusLabel: string;
  statusColor: string;
  kickoffDate: string;
  deadlineDate: string;
  judgingCloseDate: string;
  winnersDate: string;
  submissionCount: number;
  tracks: Track[];
  prizes: Array<{ rank: string; title: string; amount: string; description: string }>;
  rules: string[];
  rubric: Array<{ criterion: string; weight: string; description: string }>;
}
