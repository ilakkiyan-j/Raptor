/**
 * Pre-seeded demo account tokens from .dogfood.toml for rapid role switching.
 */

export interface DemoAccount {
  id: string;
  roleName: string;
  title: string;
  badge: string;
  color: string;
  token: string | null;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'visitor',
    roleName: 'Visitor',
    title: 'Public Guest',
    badge: 'Public View',
    color: 'slate',
    token: null,
    description: 'Unauthenticated public visitor browsing gallery and prizes.',
  },
  {
    id: 'participant',
    roleName: 'Participant',
    title: 'Ada (Nightshift Lead)',
    badge: 'Participant',
    color: 'emerald',
    token: 'demo-pt-d7f97ed29e331c278823c9361109a54e',
    description: 'Team member capable of team formation and draft submissions.',
  },
  {
    id: 'judge_a',
    roleName: 'Judge A',
    title: 'Ada Okonkwo',
    badge: 'Judge (Dev Tools)',
    color: 'indigo',
    token: 'demo-ja-c9e380efa065eb7f8187b4da697a180a',
    description: 'Assigned to evaluate developer tools projects.',
  },
  {
    id: 'judge_b',
    roleName: 'Judge B',
    title: 'Marcus Vance',
    badge: 'Judge (Security)',
    color: 'purple',
    token: 'demo-jb-075fd8b3282e0c498e18c273e803b268',
    description: 'Peer judge testing strict backend role isolation.',
  },
  {
    id: 'organizer',
    roleName: 'Organizer',
    title: 'Event Operations',
    badge: 'Organizer',
    color: 'amber',
    token: 'demo-org-29ced468c7410afa403da3619178b380',
    description: 'Event manager with dashboard, rubric control, and CSV export access.',
  },
];

export function setSessionToken(token: string | null): void {
  if (!token) {
    document.cookie = 'session=; path=/; max-age=0';
  } else {
    document.cookie = `session=${token}; path=/; max-age=864000`;
  }
}

export function getCurrentSessionToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)session=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
