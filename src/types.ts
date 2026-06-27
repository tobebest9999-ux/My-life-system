export type MainCategory = 'entertainment' | 'exercise' | 'study' | 'project';

export type EntertainmentSubCategory = 'game' | 'anime' | 'manga' | 'other';

export type ProjectStatus =
  | 'wishlist'
  | 'planned'
  | 'active'
  | 'completed'
  | 'paused'
  | 'dropped';

export type SessionSource = 'timer' | 'manual';

export type WeeklyPlanStatus = 'active' | 'completed' | 'failed' | 'skipped';

export type PlanTargetType = 'duration' | 'count' | 'completion';

export interface Project {
  id: string;
  name: string;
  mainCategory: MainCategory;
  subCategory: string;
  status: ProjectStatus;
  description: string;
  notes: string;
  imageIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  mainCategory: MainCategory;
  subCategory: string;
  projectId: string;
  projectNameSnapshot: string;
  source: SessionSource;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  content: string;
  feelings: string;
  energyScore?: number;
  moodScore?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeeklyPlan {
  id: string;
  title: string;
  mainCategory?: MainCategory;
  subCategory?: string;
  projectId?: string;
  dateRangeStart?: string;
  dateRangeEnd?: string;
  deadline?: string;
  targetType: PlanTargetType;
  targetValue?: number;
  currentProgress: number;
  status: WeeklyPlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectImage {
  id: string;
  projectId: string;
  data: string;
  caption?: string;
  createdAt: string;
}

export interface ProjectJournalEntry {
  id: string;
  projectId: string;
  date: string;
  contentHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveTimer {
  id: string;
  mainCategory: MainCategory;
  subCategory: string;
  projectId: string;
  projectNameSnapshot: string;
  startTime: string;
}

export interface Suggestion {
  id: string;
  type: 'balance' | 'rhythm' | 'plan' | 'health' | 'focus';
  message: string;
  severity: 'info' | 'warning';
}
