import { mainCategoryLabels, subCategoryLabels } from './constants';
import type { MainCategory, Project, Session, Suggestion, WeeklyPlan } from './types';

export const createId = () => {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const nowIso = () => new Date().toISOString();

export const toInputDateTime = (iso?: string) => {
  const date = iso ? new Date(iso) : new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
};

export const fromInputDateTime = (value: string) => new Date(value).toISOString();

export const formatDuration = (minutes: number) => {
  if (minutes < 60) {
    return `${Math.max(0, Math.round(minutes))}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));

export const getSubCategoryLabel = (mainCategory: MainCategory, subCategory?: string) => {
  if (!subCategory) return '未分类';
  return subCategoryLabels[mainCategory]?.[subCategory] ?? subCategory;
};

export const getCategoryPath = (session: Session) =>
  `${mainCategoryLabels[session.mainCategory]} / ${getSubCategoryLabel(
    session.mainCategory,
    session.subCategory,
  )} / ${session.projectNameSnapshot}`;

export const minutesBetween = (startIso: string, endIso: string) => {
  return Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
};

export const isThisWeek = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
};

export const summarizeByMainCategory = (sessions: Session[]) => {
  const totals: Record<MainCategory, number> = {
    entertainment: 0,
    exercise: 0,
    study: 0,
    project: 0,
  };
  sessions.forEach((session) => {
    totals[session.mainCategory] += session.durationMinutes;
  });
  return totals;
};

export const summarizeEntertainmentSubCategories = (sessions: Session[]) => {
  const totals: Record<string, number> = {
    game: 0,
    anime: 0,
    manga: 0,
    other: 0,
  };
  sessions
    .filter((session) => session.mainCategory === 'entertainment')
    .forEach((session) => {
      totals[session.subCategory] = (totals[session.subCategory] ?? 0) + session.durationMinutes;
    });
  return totals;
};

export const getProjectTotalMinutes = (projectId: string, sessions: Session[]) =>
  sessions
    .filter((session) => session.projectId === projectId)
    .reduce((total, session) => total + session.durationMinutes, 0);

export const getEffectivePlanStatus = (plan: WeeklyPlan) => {
  if (plan.status !== 'active') return plan.status;
  const now = new Date();
  const end = plan.deadline ?? plan.dateRangeEnd;
  if (end && new Date(end).getTime() < now.getTime()) {
    return 'failed';
  }
  return plan.status;
};

export const generateDashboardSuggestions = (
  sessions: Session[],
  weeklyPlans: WeeklyPlan[],
): Suggestion[] => {
  const suggestions: Suggestion[] = [];
  const weekSessions = sessions.filter((session) => isThisWeek(session.startTime));
  const weekTotals = summarizeByMainCategory(weekSessions);
  const weekTotal = Object.values(weekTotals).reduce((sum, value) => sum + value, 0);

  if (weekTotal > 0 && weekTotals.entertainment / weekTotal > 0.5) {
    suggestions.push({
      id: 'entertainment-balance',
      type: 'balance',
      severity: 'info',
      message: '本周娱乐占比较高，可以保留放松时间，但建议安排一段学习或项目时间来平衡节奏。',
    });
  }

  const lateEntertainmentCount = weekSessions.filter((session) => {
    const end = new Date(session.endTime);
    const lateMinutes = end.getHours() * 60 + end.getMinutes();
    return session.mainCategory === 'entertainment' && lateMinutes >= 23 * 60 + 30;
  }).length;

  if (lateEntertainmentCount >= 2) {
    suggestions.push({
      id: 'late-entertainment',
      type: 'rhythm',
      severity: 'warning',
      message: '最近有几次娱乐结束得比较晚，可以尝试提前结束，保护睡眠节奏。',
    });
  }

  const soonPlans = weeklyPlans.filter((plan) => {
    if (getEffectivePlanStatus(plan) !== 'active') return false;
    const target = plan.deadline ?? plan.dateRangeEnd;
    if (!target) return false;
    const diff = new Date(target).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000;
  });

  if (soonPlans.length > 0) {
    suggestions.push({
      id: 'plans-due-soon',
      type: 'plan',
      severity: 'warning',
      message: '有计划快到截止时间了，建议今天安排一小段时间推进。',
    });
  }

  const exerciseSessions = sessions.filter((session) => session.mainCategory === 'exercise');
  const latestExercise = exerciseSessions
    .map((session) => new Date(session.endTime).getTime())
    .sort((a, b) => b - a)[0];
  if (!latestExercise || Date.now() - latestExercise > 5 * 24 * 60 * 60 * 1000) {
    suggestions.push({
      id: 'exercise-gap',
      type: 'health',
      severity: 'info',
      message: '最近几天没有运动记录，可以安排一次轻量运动。',
    });
  }

  if (weekTotals.project < 120) {
    suggestions.push({
      id: 'project-time-low',
      type: 'focus',
      severity: 'info',
      message: '本周项目时间偏少，可以安排一个更完整的项目时间块。',
    });
  }

  const focusSessions = weekSessions.filter(
    (session) => session.mainCategory === 'study' || session.mainCategory === 'project',
  );
  const focusAverage =
    focusSessions.length > 0
      ? focusSessions.reduce((sum, session) => sum + session.durationMinutes, 0) / focusSessions.length
      : 0;
  if (focusSessions.length >= 2 && focusAverage < 25) {
    suggestions.push({
      id: 'fragmented-focus',
      type: 'focus',
      severity: 'info',
      message: '学习或项目时间比较碎片化，可以尝试安排更集中的时间块。',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      id: 'steady-start',
      type: 'balance',
      severity: 'info',
      message: '目前记录还比较平稳，可以继续保持，把今天最重要的一件事先安排出来。',
    });
  }

  return suggestions;
};

export const getHighFrequencyEntertainmentPeriods = (sessions: Session[]) => {
  const buckets = [
    { label: '上午', start: 6, end: 12, minutes: 0 },
    { label: '下午', start: 12, end: 18, minutes: 0 },
    { label: '晚上', start: 18, end: 24, minutes: 0 },
    { label: '深夜', start: 0, end: 6, minutes: 0 },
  ];

  sessions
    .filter((session) => session.mainCategory === 'entertainment')
    .forEach((session) => {
      const hour = new Date(session.startTime).getHours();
      const bucket = buckets.find((item) => hour >= item.start && hour < item.end);
      if (bucket) bucket.minutes += session.durationMinutes;
    });

  return buckets.sort((a, b) => b.minutes - a.minutes);
};

export const getTopProjects = (projects: Project[], sessions: Session[], mainCategory?: MainCategory) =>
  projects
    .filter((project) => !mainCategory || project.mainCategory === mainCategory)
    .map((project) => ({
      project,
      minutes: getProjectTotalMinutes(project.id, sessions),
    }))
    .sort((a, b) => b.minutes - a.minutes);
