import type { MainCategory, ProjectStatus } from './types';

export const mainCategoryLabels: Record<MainCategory, string> = {
  entertainment: '娱乐',
  exercise: '运动',
  study: '\u5b66\u4e60',
  project: '项目',
};

export const mainCategoryOptions: MainCategory[] = ['entertainment', 'exercise', 'study', 'project'];

export const subCategoryLabels: Record<MainCategory, Record<string, string>> = {
  entertainment: {
    game: '游戏',
    anime: '动画',
    manga: '漫画',
    other: '其他',
  },
  exercise: {
    strength: '\u529b\u91cf',
    cardio: '\u6709\u6c27',
    other: '\u5176\u4ed6',
  },
  study: {
    computer: '\u8ba1\u7b97\u673a',
    math: '\u6570\u5b66',
    english: '\u82f1\u8bed',
    other: '\u5176\u4ed6',
  },
  project: {
    general: '通用',
  },
};

export const defaultSubCategory: Record<MainCategory, string> = {
  entertainment: 'game',
  exercise: 'strength',
  study: 'computer',
  project: 'general',
};

export const projectStatusLabels: Record<ProjectStatus, string> = {
  wishlist: '想玩/想看',
  planned: '计划中',
  active: '进行中',
  completed: '已完成',
  paused: '暂停',
  dropped: '放弃',
};

export const projectStatusOptions: ProjectStatus[] = [
  'wishlist',
  'planned',
  'active',
  'completed',
  'paused',
  'dropped',
];

export const planTargetLabels = {
  duration: '时长',
  count: '次数',
  completion: '完成事项',
} as const;

export const planStatusLabels = {
  active: '进行中',
  completed: '已完成',
  failed: '已失败',
  skipped: '已跳过',
} as const;
