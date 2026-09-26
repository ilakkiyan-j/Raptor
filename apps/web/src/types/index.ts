export type UserRole = 'visitor' | 'participant' | 'judge' | 'organizer' | 'admin';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface Event {
  id: string;
  name: string;
  submissions_close: string;
}

export interface Track {
  id: string;
  name: string;
  description?: string;
}

export interface Team {
  id: string;
  name: string;
  members: string[];
}

export interface Project {
  id: string;
  team: string;
  track: string;
  title: string;
  summary: string;
  repo_url: string;
  submitted_at: string;
}

export interface ScoreCriterion {
  [key: string]: number;
}

export interface Evaluation {
  id?: string;
  judge: string;
  project: string;
  criteria: ScoreCriterion;
  comment?: string;
}

export interface GalleryResponse {
  items: Project[];
  page: number;
  limit: number;
  total: number;
}
