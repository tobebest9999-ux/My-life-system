import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent, type ReactNode } from 'react';
import {
  defaultSubCategory,
  mainCategoryLabels,
  mainCategoryOptions,
  planStatusLabels,
  planTargetLabels,
  projectStatusLabels,
  projectStatusOptions,
  subCategoryLabels,
} from './constants';
import { storage } from './storage';
import type {
  ActiveTimer,
  ExercisePlan,
  ExerciseSubCategory,
  StudyChapter,
  StudyLibraryItem,
  StudyLibraryPlan,
  StudyLibraryType,
  StudySubCategory,
  GrowthMetric,
  GrowthRecord,
  MainCategory,
  PlanTargetType,
  Project,
  ProjectImage,
  ProjectJournalEntry,
  ProjectLibraryAsset,
  ProjectReminder,
  ProjectStatus,
  ProjectSubCategory,
  ProjectTask,
  Session,
  SessionAttachment,
  WeeklyPlan,
} from './types';
import {
  createId,
  formatDate,
  formatDateTime,
  formatDuration,
  fromInputDateTime,
  generateDashboardSuggestions,
  getCategoryPath,
  getEffectivePlanStatus,
  getHighFrequencyEntertainmentPeriods,
  getProjectTotalMinutes,
  getSubCategoryLabel,
  getTopProjects,
  minutesBetween,
  nowIso,
  summarizeByMainCategory,
  summarizeEntertainmentSubCategories,
  toInputDateTime,
} from './utils';

type PageKey = 'dashboard' | 'entertainment' | 'exercise' | 'study' | 'projects';
type DialogKind = 'quickStart' | 'endTimer' | 'manualSession' | null;

interface ManualPreset {
  mainCategory?: MainCategory;
  subCategory?: string;
  projectId?: string;
}

const T = {
  appName: '个人管理系统',
  appSubtitle: '记录时间与节奏',
  stage: '第一阶段',
  dashboard: '主仪表盘',
  entertainment: '娱乐',
  exercise: '运动',
  study: '学习',
  projects: '项目',
  manualSession: '手动添加记录',
  quickStart: '快速开始',
  activeTimer: '当前计时',
  noActiveTimer: '当前没有正在进行的计时',
  running: '正在计时',
  endTimer: '结束计时',
  timeDistribution: '时间分布',
  recentRecords: '最近记录',
  noRecords: '还没有时间记录',
  weeklyPlans: '周计划',
  newPlan: '新增计划',
  suggestions: '整体建议',
  mainCategory: '主分类',
  subCategory: '子分类',
  chooseProject: '选择项目',
  project: '项目',
  createProject: '创建项目',
  createEntertainmentProject: '创建娱乐项目',
  projectName: '项目名称',
  projectStatus: '项目状态',
  startTimer: '开始计时',
  cancel: '取消',
  saveRecord: '保存记录',
  savePlan: '保存计划',
  saveNotes: '保存笔记',
  whatDone: '本次做了什么？',
  feeling: '本次感觉如何？',
  moodScore: '心情评分',
  energyScore: '精力评分',
  startTime: '开始时间',
  endTime: '结束时间',
  selectProject: '请选择项目',
  selectOrCreateProject: '请选择项目，或创建新项目。',
  projectPlaceholder: '例如：艾尔登法环',
  noProject: '暂无项目',
  noPlan: '还没有周计划',
  planTitle: '计划标题',
  relatedCategory: '关联分类',
  relatedProject: '关联项目',
  targetType: '目标类型',
  targetValue: '目标值',
  currentProgress: '当前进度',
  deadline: '截止时间',
  noRelatedCategory: '不关联分类',
  noRelatedProject: '不关联项目',
  updateProgress: '更新进度',
  markCompleted: '标记完成',
  skip: '跳过',
  entertainmentDistribution: '娱乐时间分布',
  frequentPeriods: '高频娱乐时段',
  topEntertainmentProjects: '娱乐时长排行',
  projectLibrary: '项目库',
  projectImages: '项目图片',
  imageCaption: '图片说明',
  imageUrl: '图片网址',
  addUrl: '添加网址',
  addImage: '添加图片',
  notes: '笔记',
  detailHistory: '详细记录历史',
  noSession: '还没有记录',
  chooseOrCreateDetail: '选择或创建一个项目后，可以查看详情和记录。',
  noContent: '暂无内容',
  loading: '正在加载本地数据...',
  close: '关闭',
  noCategoryValidation: '请选择主分类',
  noSubCategoryValidation: '请选择子分类',
  noProjectValidation: '请选择项目',
  noStartValidation: '请选择开始时间',
  noEndValidation: '请选择结束时间',
  endBeforeStart: '结束时间不能早于开始时间',
  oneTimerOnly: '有一个未结束的计时，请先结束当前计时。',
  noPlanTitle: '请输入计划标题',
  basicEntry: '基础记录入口',
  createBasicProject: '创建一个基础项目',
  exercisePlaceholder: '这里先保留基础记录入口，后续再细化运动类型、强度、身体状态和恢复节奏。',
  studyPlaceholder: '这里先保留基础记录入口，后续再细化课程、知识点、题目练习和复盘方式。',
  projectPlaceholderPage: '这里先保留基础记录入口，后续再细化个人项目、任务拆分、里程碑和交付记录。',
};

const pageLabels: Record<PageKey, string> = {
  dashboard: T.dashboard,
  entertainment: T.entertainment,
  exercise: T.exercise,
  study: T.study,
  projects: T.projects,
};

const navItems: { key: PageKey; label: string }[] = [
  { key: 'dashboard', label: T.dashboard },
  { key: 'entertainment', label: T.entertainment },
  { key: 'exercise', label: T.exercise },
  { key: 'study', label: T.study },
  { key: 'projects', label: T.projects },
];

const commonUi = {
  back: '\u8fd4\u56de',
  delete: '\u5220\u9664',
  action: '\u64cd\u4f5c',
  cannotDeleteRunning: '\u8fd9\u4e2a\u9879\u76ee\u6b63\u5728\u8ba1\u65f6\u4e2d\uff0c\u8bf7\u5148\u7ed3\u675f\u8ba1\u65f6\u518d\u5220\u9664\u3002',
  confirmDeleteProjectStart: '\u786e\u5b9a\u5220\u9664\u9879\u76ee\u300c',
  confirmDeleteProjectEnd: '\u300d\u5417\uff1f\u5386\u53f2\u65f6\u95f4\u8bb0\u5f55\u4f1a\u4fdd\u7559\uff0c\u4f46\u9879\u76ee\u8d44\u6599\u3001\u56fe\u7247\u3001\u65e5\u8bb0\u548c\u5173\u8054\u8ba1\u5212\u4f1a\u5220\u9664\u3002',
  confirmDeleteMetricStart: '\u786e\u5b9a\u5220\u9664\u6210\u957f\u9879\u300c',
  confirmDeleteMetricEnd: '\u300d\u5417\uff1f\u8fd9\u4e2a\u6210\u957f\u9879\u4e0b\u9762\u7684\u8bb0\u5f55\u4e5f\u4f1a\u4e00\u8d77\u5220\u9664\u3002',
  confirmDeleteGrowthRecord: '\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u6210\u957f\u8bb0\u5f55\u5417\uff1f',
  confirmDeleteReminder: '\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u63d0\u9192\u5417\uff1f',
  confirmDeleteWeeklyPlan: '\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u5468\u8ba1\u5212\u5417\uff1f',
  confirmDeleteStudyChapter: '\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u77e5\u8bc6\u7ae0\u8282\u5417\uff1f',
  confirmDeleteStudyLibraryItem: '\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u5185\u5bb9\u5417\uff1f',
  noExerciseData: '\u6682\u65e0\u8fd0\u52a8\u8bb0\u5f55',
};

function sortByCreated<TItem extends { createdAt: string }>(items: TItem[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function isLegacyEntertainmentReminder(plan: WeeklyPlan) {
  const looksLikeReminderTitle = /^\u8fdb\u884c\s*/.test(plan.title.trim());
  return plan.mainCategory === 'entertainment'
    && Boolean(plan.projectId)
    && Boolean(plan.deadline)
    && !plan.dateRangeStart
    && !plan.dateRangeEnd
    && plan.targetType === 'completion'
    && typeof plan.targetValue !== 'number'
    && looksLikeReminderTitle;
}

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [pageHistory, setPageHistory] = useState<PageKey[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [projectReminders, setProjectReminders] = useState<ProjectReminder[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [projectLibraryAssets, setProjectLibraryAssets] = useState<ProjectLibraryAsset[]>([]);
  const [exercisePlans, setExercisePlans] = useState<ExercisePlan[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetric[]>([]);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [studyChapters, setStudyChapters] = useState<StudyChapter[]>([]);
  const [studyLibraryItems, setStudyLibraryItems] = useState<StudyLibraryItem[]>([]);
  const [studyLibraryPlans, setStudyLibraryPlans] = useState<StudyLibraryPlan[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [journalEntries, setJournalEntries] = useState<ProjectJournalEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [quickStartCategory, setQuickStartCategory] = useState<MainCategory>('entertainment');
  const [manualPreset, setManualPreset] = useState<ManualPreset>({});
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [storedProjects, storedSessions, storedPlans, storedImages, storedJournalEntries, storedProjectReminders, storedProjectTasks, storedProjectLibraryAssets, storedExercisePlans, storedGrowthMetrics, storedGrowthRecords, storedStudyChapters, storedStudyLibraryItems, storedStudyLibraryPlans, storedTimer] = await Promise.all([
      storage.getProjects(),
      storage.getSessions(),
      storage.getWeeklyPlans(),
      storage.getProjectImages(),
      storage.getProjectJournalEntries(),
      storage.getProjectReminders(),
      storage.getProjectTasks(),
      storage.getProjectLibraryAssets(),
      storage.getExercisePlans(),
      storage.getGrowthMetrics(),
      storage.getGrowthRecords(),
      storage.getStudyChapters(),
      storage.getStudyLibraryItems(),
      storage.getStudyLibraryPlans(),
      storage.getActiveTimer(),
    ]);
    setProjects(sortByCreated(storedProjects));
    setSessions(sortByCreated(storedSessions));
    setWeeklyPlans(sortByCreated(storedPlans));
    setImages(storedImages);
    setJournalEntries(storedJournalEntries);
    setProjectReminders(sortByCreated(storedProjectReminders));
    setProjectTasks(sortByCreated(storedProjectTasks));
    setProjectLibraryAssets(sortByCreated(storedProjectLibraryAssets));
    setExercisePlans(sortByCreated(storedExercisePlans));
    setGrowthMetrics(sortByCreated(storedGrowthMetrics));
    setGrowthRecords(sortByCreated(storedGrowthRecords));
    setStudyChapters(sortByCreated(storedStudyChapters));
    setStudyLibraryItems(sortByCreated(storedStudyLibraryItems));
    setStudyLibraryPlans(sortByCreated(storedStudyLibraryPlans));
    setActiveTimer(storedTimer);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

  const navigatePage = (nextPage: PageKey) => {
    setPage((current) => {
      if (current === nextPage) return current;
      setPageHistory((history) => [...history, current]);
      return nextPage;
    });
  };

  const goBack = () => {
    setPageHistory((history) => {
      const previous = history[history.length - 1];
      if (!previous) return history;
      setPage(previous);
      return history.slice(0, -1);
    });
  };

  const createProject = async (input: {
    name: string;
    mainCategory: MainCategory;
    subCategory: string;
    status?: ProjectStatus;
    imageUrl?: string;
  }) => {
    const timestamp = nowIso();
    const project: Project = {
      id: createId(),
      name: input.name.trim(),
      mainCategory: input.mainCategory,
      subCategory: input.subCategory,
      status: input.status ?? 'active',
      description: '',
      notes: '',
      imageIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storage.saveProject(project);
    if (input.imageUrl?.trim()) {
      const image: ProjectImage = {
        id: createId(),
        projectId: project.id,
        data: input.imageUrl.trim(),
        caption: project.name,
        createdAt: timestamp,
      };
      await storage.saveProjectImage(image);
      await storage.saveProject({ ...project, imageIds: [image.id], updatedAt: nowIso() });
    }
    await reload();
    return project;
  };

  const updateProject = async (project: Project) => {
    await storage.saveProject({ ...project, updatedAt: nowIso() });
    await reload();
  };

  const deleteProject = async (project: Project) => {
    if (activeTimer?.projectId === project.id) {
      window.alert(commonUi.cannotDeleteRunning);
      return;
    }
    const confirmed = window.confirm(commonUi.confirmDeleteProjectStart + project.name + commonUi.confirmDeleteProjectEnd);
    if (!confirmed) return;
    await Promise.all([
      ...images.filter((image) => image.projectId === project.id).map((image) => storage.deleteProjectImage(image.id)),
      ...journalEntries.filter((entry) => entry.projectId === project.id).map((entry) => storage.deleteProjectJournalEntry(entry.id)),
      ...weeklyPlans.filter((plan) => plan.projectId === project.id).map((plan) => storage.deleteWeeklyPlan(plan.id)),
      ...projectReminders.filter((reminder) => reminder.projectId === project.id).map((reminder) => storage.deleteProjectReminder(reminder.id)),
      ...projectTasks.filter((task) => task.projectId === project.id).map((task) => storage.deleteProjectTask(task.id)),
      ...projectLibraryAssets.filter((asset) => asset.projectId === project.id).map((asset) => storage.deleteProjectLibraryAsset(asset.id)),
      ...exercisePlans.filter((plan) => plan.projectId === project.id).map((plan) => storage.deleteExercisePlan(plan.id)),
      ...studyChapters.filter((chapter) => chapter.projectId === project.id).map((chapter) => storage.deleteStudyChapter(chapter.id)),
      ...studyLibraryItems.filter((item) => item.projectId === project.id).map((item) => storage.deleteStudyLibraryItem(item.id)),
    ]);
    await storage.deleteProject(project.id);
    await reload();
  };

  const deleteGrowthMetric = async (metric: GrowthMetric) => {
    const confirmed = window.confirm(commonUi.confirmDeleteMetricStart + metric.name + commonUi.confirmDeleteMetricEnd);
    if (!confirmed) return;
    await Promise.all(growthRecords.filter((record) => record.metricId === metric.id).map((record) => storage.deleteGrowthRecord(record.id)));
    await storage.deleteGrowthMetric(metric.id);
    await reload();
  };

  const startTimer = async (project: Project) => {
    if (activeTimer) {
      window.alert(T.oneTimerOnly);
      return;
    }
    await storage.saveActiveTimer({
      id: createId(),
      mainCategory: project.mainCategory,
      subCategory: project.subCategory,
      projectId: project.id,
      projectNameSnapshot: project.name,
      startTime: nowIso(),
    });
    setDialog(null);
    navigatePage('dashboard');
    await reload();
  };

  const saveSession = async (session: Session) => {
    await storage.saveSession(session);
    await reload();
  };

  const finishTimer = async (content: string, feelings: string, moodScore?: number, energyScore?: number, attachments: SessionAttachment[] = [], chapterIds: string[] = []) => {
    if (!activeTimer) return;
    const endTime = nowIso();
    const timestamp = nowIso();
    const session: Session = {
      id: createId(),
      mainCategory: activeTimer.mainCategory,
      subCategory: activeTimer.subCategory,
      projectId: activeTimer.projectId,
      projectNameSnapshot: activeTimer.projectNameSnapshot,
      source: 'timer',
      startTime: activeTimer.startTime,
      endTime,
      durationMinutes: minutesBetween(activeTimer.startTime, endTime),
      content,
      feelings,
      moodScore,
      energyScore,
      attachments,
      chapterIds: chapterIds.length > 0 ? chapterIds : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await storage.saveSession(session);
    await storage.clearActiveTimer();
    setDialog(null);
    await reload();
  };

  const savePlan = async (plan: WeeklyPlan) => {
    await storage.saveWeeklyPlan({ ...plan, updatedAt: nowIso() });
    await reload();
  };

  const deletePlan = async (plan: WeeklyPlan) => {
    const confirmed = window.confirm(commonUi.confirmDeleteWeeklyPlan);
    if (!confirmed) return;
    await storage.deleteWeeklyPlan(plan.id);
    await reload();
  };

  const saveProjectReminder = async (reminder: ProjectReminder) => {
    await storage.saveProjectReminder({ ...reminder, updatedAt: nowIso() });
    await reload();
  };

  const deleteProjectReminder = async (reminder: ProjectReminder) => {
    const confirmed = window.confirm(commonUi.confirmDeleteReminder);
    if (!confirmed) return;
    await storage.deleteProjectReminder(reminder.id);
    await reload();
  };

  const saveProjectTask = async (task: ProjectTask) => {
    await storage.saveProjectTask({ ...task, updatedAt: nowIso() });
    await reload();
  };

  const deleteProjectTask = async (task: ProjectTask) => {
    const confirmed = window.confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u4e2a\u9879\u76ee\u4efb\u52a1\u5417\uff1f');
    if (!confirmed) return;
    await storage.deleteProjectTask(task.id);
    await reload();
  };

  const saveProjectLibraryAsset = async (asset: ProjectLibraryAsset) => {
    await storage.saveProjectLibraryAsset({ ...asset, updatedAt: nowIso() });
    await reload();
  };

  const deleteProjectLibraryAsset = async (asset: ProjectLibraryAsset) => {
    const confirmed = window.confirm('\u786e\u5b9a\u5220\u9664\u8fd9\u6761\u9879\u76ee\u5e93\u8d44\u6599\u5417\uff1f');
    if (!confirmed) return;
    await storage.deleteProjectLibraryAsset(asset.id);
    await reload();
  };

  const saveExercisePlan = async (plan: ExercisePlan) => {
    await storage.saveExercisePlan({ ...plan, updatedAt: nowIso() });
    await reload();
  };

  const deleteExercisePlan = async (plan: ExercisePlan) => {
    const confirmed = window.confirm(commonUi.confirmDeleteReminder);
    if (!confirmed) return;
    await storage.deleteExercisePlan(plan.id);
    await reload();
  };

  const saveGrowthMetric = async (metric: GrowthMetric) => {
    await storage.saveGrowthMetric({ ...metric, updatedAt: nowIso() });
    await reload();
  };

  const saveGrowthRecord = async (record: GrowthRecord) => {
    await storage.saveGrowthRecord({ ...record, updatedAt: nowIso() });
    await reload();
  };

  const saveStudyChapter = async (chapter: StudyChapter) => {
    await storage.saveStudyChapter({ ...chapter, updatedAt: nowIso() });
    await reload();
  };

  const deleteStudyChapter = async (chapter: StudyChapter) => {
    const confirmed = window.confirm(commonUi.confirmDeleteStudyChapter);
    if (!confirmed) return;
    await storage.deleteStudyChapter(chapter.id);
    await reload();
  };

  const saveStudyLibraryItem = async (item: StudyLibraryItem) => {
    await storage.saveStudyLibraryItem({ ...item, updatedAt: nowIso() });
    await reload();
  };

  const deleteStudyLibraryItem = async (item: StudyLibraryItem) => {
    const confirmed = window.confirm(commonUi.confirmDeleteStudyLibraryItem);
    if (!confirmed) return;
    await storage.deleteStudyLibraryItem(item.id);
    await reload();
  };

  const saveStudyLibraryPlan = async (plan: StudyLibraryPlan) => {
    await storage.saveStudyLibraryPlan({ ...plan, updatedAt: nowIso() });
    await reload();
  };

  const deleteGrowthRecord = async (record: GrowthRecord) => {
    const confirmed = window.confirm(commonUi.confirmDeleteGrowthRecord);
    if (!confirmed) return;
    await storage.deleteGrowthRecord(record.id);
    await reload();
  };

  const addImage = async (project: Project, data: string, caption?: string) => {
    const image: ProjectImage = { id: createId(), projectId: project.id, data, caption, createdAt: nowIso() };
    await storage.saveProjectImage(image);
    await storage.saveProject({ ...project, imageIds: [...project.imageIds, image.id], updatedAt: nowIso() });
    await reload();
  };

  const saveJournalEntry = async (entry: ProjectJournalEntry) => {
    await storage.saveProjectJournalEntry(entry);
    setJournalEntries((current) => {
      const next = current.filter((item) => item.id !== entry.id);
      return sortByCreated([...next, entry]);
    });
  };

  const openManual = (preset: ManualPreset = {}) => {
    setManualPreset(preset);
    setDialog('manualSession');
  };

  const openQuickStart = (category: MainCategory) => {
    setQuickStartCategory(category);
    setDialog('quickStart');
  };

  const dashboardPlans = weeklyPlans.filter((plan) => !isLegacyEntertainmentReminder(plan));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">{T.appName[0]}</div>
          <div>
            <div className="brand-title">{T.appName}</div>
            <div className="brand-subtitle">{T.appSubtitle}</div>
          </div>
        </div>
        <nav className="nav-list" aria-label={T.appName}>
          {navItems.map((item) => (
            <button key={item.key} className={page === item.key ? 'nav-button active' : 'nav-button'} onClick={() => navigatePage(item.key)}>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <header className="page-header">
          <div>
            <p className="eyebrow">{T.stage}</p>
            <h1>{pageLabels[page]}</h1>
          </div>
          <div className="page-actions">{pageHistory.length > 0 ? <button className="ghost-button" onClick={goBack}>{commonUi.back}</button> : null}<button className="secondary-button" onClick={() => openManual()}>{T.manualSession}</button></div>
        </header>
        {loading ? <section className="panel">{T.loading}</section> : null}
        {!loading && page === 'dashboard' ? (
          <DashboardPage
            projects={projects}
            sessions={sessions}
            plans={dashboardPlans}
            activeTimer={activeTimer}
            onQuickStart={openQuickStart}
            onEndTimer={() => setDialog('endTimer')}
            onManualSession={() => openManual()}
            onSavePlan={savePlan}
            onDeletePlan={deletePlan}
          />
        ) : null}
        {!loading && page === 'entertainment' ? (
          <EntertainmentPage
            projects={projects}
            sessions={sessions}
            images={images}
            reminders={projectReminders}
            activeTimer={activeTimer}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            onStartTimer={startTimer}
            onManualSession={openManual}
            journalEntries={journalEntries}
            onAddImage={addImage}
            onSaveJournalEntry={saveJournalEntry}
            onSaveReminder={saveProjectReminder}
            onDeleteReminder={deleteProjectReminder}
          />
        ) : null}
        {!loading && page === 'exercise' ? (
          <ExercisePage
            projects={projects}
            sessions={sessions}
            exercisePlans={exercisePlans}
            growthMetrics={growthMetrics}
            growthRecords={growthRecords}
            activeTimer={activeTimer}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            onStartTimer={startTimer}
            onManualSession={openManual}
            onSaveExercisePlan={saveExercisePlan}
            onDeleteExercisePlan={deleteExercisePlan}
            onSaveGrowthMetric={saveGrowthMetric}
            onDeleteGrowthMetric={deleteGrowthMetric}
            onSaveGrowthRecord={saveGrowthRecord}
            onDeleteGrowthRecord={deleteGrowthRecord}
            onSaveSession={saveSession}
          />
        ) : null}
        {!loading && page === 'study' ? (
          <StudyPage
            projects={projects}
            sessions={sessions}
            studyChapters={studyChapters}
            studyLibraryItems={studyLibraryItems}
            studyLibraryPlans={studyLibraryPlans}
            activeTimer={activeTimer}
            onCreateProject={createProject}
            onDeleteProject={deleteProject}
            onStartTimer={startTimer}
            onManualSession={openManual}
            onSaveChapter={saveStudyChapter}
            onDeleteChapter={deleteStudyChapter}
            onSaveLibraryItem={saveStudyLibraryItem}
            onDeleteLibraryItem={deleteStudyLibraryItem}
            onSaveLibraryPlan={saveStudyLibraryPlan}
          />
        ) : null}
        {!loading && page === 'projects' ? (
          <ProjectSystemPage projects={projects} sessions={sessions} journalEntries={journalEntries} reminders={projectReminders} tasks={projectTasks} assets={projectLibraryAssets} activeTimer={activeTimer} onCreateProject={createProject} onDeleteProject={deleteProject} onStartTimer={startTimer} onManualSession={openManual} onSaveJournalEntry={saveJournalEntry} onSaveReminder={saveProjectReminder} onDeleteReminder={deleteProjectReminder} onSaveTask={saveProjectTask} onDeleteTask={deleteProjectTask} onSaveAsset={saveProjectLibraryAsset} onDeleteAsset={deleteProjectLibraryAsset} />
        ) : null}
      </main>

      {dialog === 'quickStart' ? <QuickStartDialog initialCategory={quickStartCategory} projects={projects} onClose={() => setDialog(null)} onCreateProject={createProject} onStartTimer={startTimer} /> : null}
      {dialog === 'endTimer' && activeTimer ? <TimerEndDialog timer={activeTimer} studyChapters={studyChapters} onClose={() => setDialog(null)} onSave={finishTimer} /> : null}
      {dialog === 'manualSession' ? <ManualSessionDialog preset={manualPreset} projects={projects} studyChapters={studyChapters} onClose={() => setDialog(null)} onCreateProject={createProject} onSave={async (session) => { await saveSession(session); setDialog(null); }} /> : null}
    </div>
  );
}

function DashboardPage({ projects, sessions, plans, activeTimer, onQuickStart, onEndTimer, onManualSession, onSavePlan, onDeletePlan }: {
  projects: Project[];
  sessions: Session[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onQuickStart: (category: MainCategory) => void;
  onEndTimer: () => void;
  onManualSession: () => void;
  onSavePlan: (plan: WeeklyPlan) => Promise<void>;
  onDeletePlan: (plan: WeeklyPlan) => Promise<void>;
}) {
  const totals = useMemo(() => summarizeByMainCategory(sessions), [sessions]);
  const suggestions = useMemo(() => generateDashboardSuggestions(sessions, plans), [sessions, plans]);
  return (
    <div className="dashboard-sketch-layout">
      <section className="panel dashboard-quick-panel sketch-full-row">
        <div className="section-heading"><h2>{T.quickStart}</h2><button className="ghost-button" onClick={onManualSession}>{T.manualSession}</button></div>
        <div className="quick-grid">
          {mainCategoryOptions.map((category) => <button key={category} className="quick-button" onClick={() => onQuickStart(category)}>{'\u5f00\u59cb' + mainCategoryLabels[category]}</button>)}
        </div>
      </section>
      <section className="panel dashboard-active-panel sketch-half-row">
        <h2>{T.activeTimer}</h2>
        {activeTimer ? <ActiveTimerCard timer={activeTimer} onEndTimer={onEndTimer} /> : <p className="empty-text">{T.noActiveTimer}</p>}
      </section>
      <section className="panel dashboard-calendar-corner sketch-half-row"><DashboardCalendar sessions={sessions} plans={plans} /></section>
      <section className="panel sketch-half-row">
        <h2>{T.timeDistribution}</h2>
        <PieTimeDistribution totals={totals} />
      </section>
      <section className="panel sketch-half-row"><WeeklyPlanPanel projects={projects} plans={plans} onSavePlan={onSavePlan} onDeletePlan={onDeletePlan} /></section>
      <section className="panel sketch-full-row">
        <h2>{T.recentRecords}</h2>
        {sessions.length === 0 ? <p className="empty-text">{T.noRecords}</p> : <SessionList sessions={sessions.slice(0, 6)} />}
      </section>
      <section className="panel sketch-full-row"><h2>{T.suggestions}</h2><div className="suggestion-list">{suggestions.map((item) => <div className={'suggestion ' + item.severity} key={item.id}>{item.message}</div>)}</div></section>
    </div>
  );
}

function ActiveTimerCard({ timer, onEndTimer }: { timer: ActiveTimer; onEndTimer: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(timer.startTime).getTime()) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const handAngle = (elapsedSeconds % 60) * 6;
  return (
    <div className="active-timer">
      <p className="timer-label">{T.running}</p>
      <div className="clock-wrap" aria-label="计时中的转动时钟">
        <div className="clock-face">
          <div className="clock-hand" style={{ transform: 'rotate(' + handAngle + 'deg)' }} />
          <div className="clock-center" />
        </div>
        <div className="clock-time">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
      </div>
      <h3>{timer.projectNameSnapshot}</h3>
      <p>{mainCategoryLabels[timer.mainCategory]} / {getSubCategoryLabel(timer.mainCategory, timer.subCategory)}</p>
      <button className="danger-button" onClick={onEndTimer}>{T.endTimer}</button>
    </div>
  );
}

function PieTimeDistribution({ totals }: { totals: Record<MainCategory, number> }) {
  const total = Object.values(totals).reduce((sum, minutes) => sum + minutes, 0);
  const colors: Record<MainCategory, string> = { entertainment: '#16645a', exercise: '#c47d2c', study: '#4267a8', project: '#b64242' };
  let cursor = 0;
  const segments = mainCategoryOptions.map((category) => {
    const start = cursor;
    const size = total > 0 ? (totals[category] / total) * 100 : 0;
    cursor += size;
    return colors[category] + ' ' + start + '% ' + cursor + '%';
  }).join(', ');
  return <div className="pie-layout"><div className="pie-chart" style={{ background: total > 0 ? 'conic-gradient(' + segments + ')' : '#e4ebe8' }}><div>{total > 0 ? formatDuration(total) : '0分钟'}</div></div><div className="pie-legend">{mainCategoryOptions.map((category) => { const percent = total > 0 ? Math.round((totals[category] / total) * 100) : 0; return <div className="legend-row" key={category}><span style={{ background: colors[category] }} /><strong>{mainCategoryLabels[category]}</strong><em>{formatDuration(totals[category])} / {percent}%</em></div>; })}</div></div>;
}

function DashboardCalendar({ sessions, plans }: { sessions: Session[]; plans: WeeklyPlan[] }) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, index) => new Date(year, month, index + 1))];
  const selectedSessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === selectedDate);
  const datePlanState = (date: Date) => {
    const key = toDateKey(date);
    const duePlans = plans.filter((plan) => {
      const target = plan.deadline ?? plan.dateRangeEnd;
      return target ? toDateKey(new Date(target)) === key : false;
    });
    if (duePlans.some((plan) => getEffectivePlanStatus(plan) === 'failed')) return 'failed';
    if (duePlans.some((plan) => getEffectivePlanStatus(plan) === 'completed')) return 'completed';
    if (selectedDate === key) return 'selected';
    if (sessions.some((session) => toDateKey(new Date(session.startTime)) === key)) return 'has-session';
    return '';
  };
  return <div className="calendar-panel mini-calendar"><div className="mini-calendar-top"><button className="calendar-nav-button" aria-label="上个月" onClick={() => setMonthCursor(new Date(year, month - 1, 1))}>‹</button><strong>{year}年{month + 1}月</strong><button className="calendar-nav-button" aria-label="下个月" onClick={() => setMonthCursor(new Date(year, month + 1, 1))}>›</button></div><div className="calendar-weekdays">{['日','一','二','三','四','五','六'].map((day) => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map((date, index) => date ? <button key={toDateKey(date)} className={'calendar-day ' + datePlanState(date)} onClick={() => setSelectedDate(toDateKey(date))}><span>{date.getDate()}</span></button> : <span key={'empty-' + index} className="calendar-empty" />)}</div><div className="calendar-detail mini-calendar-detail"><h3>{selectedDate}</h3>{selectedSessions.length === 0 ? <p className="empty-text">这一天还没有时间记录</p> : <SessionList sessions={selectedSessions.slice(0, 2)} />}</div></div>;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function QuickStartDialog({ initialCategory, projects, onClose, onCreateProject, onStartTimer }: {
  initialCategory: MainCategory;
  projects: Project[];
  onClose: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onStartTimer: (project: Project) => Promise<void>;
}) {
  const [mainCategory, setMainCategory] = useState<MainCategory>(initialCategory);
  const [subCategory, setSubCategory] = useState(defaultSubCategory[initialCategory]);
  const [projectId, setProjectId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const available = projects.filter((project) => project.mainCategory === mainCategory && project.subCategory === subCategory);
  const changeCategory = (value: MainCategory) => { setMainCategory(value); setSubCategory(defaultSubCategory[value]); setProjectId(''); };
  const submit = async () => {
    let project = available.find((item) => item.id === projectId);
    if (!project && newName.trim()) project = await onCreateProject({ name: newName, mainCategory, subCategory, status: 'active' });
    if (!project) { setError(T.selectOrCreateProject); return; }
    await onStartTimer(project);
  };
  return <Dialog title={T.quickStart} onClose={onClose}><div className="form-grid"><SelectMainCategory value={mainCategory} onChange={changeCategory} /><SelectSubCategory mainCategory={mainCategory} value={subCategory} onChange={setSubCategory} /><label className="full-width"><span>{T.chooseProject}</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{T.selectProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="full-width"><span>{T.createProject}</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={T.projectPlaceholder} /></label></div>{error ? <p className="error-text">{error}</p> : null}<DialogActions onCancel={onClose} actionLabel={T.startTimer} onAction={submit} /></Dialog>;
}

function TimerEndDialog({ timer, studyChapters, onClose, onSave }: { timer: ActiveTimer; studyChapters: StudyChapter[]; onClose: () => void; onSave: (content: string, feelings: string, moodScore?: number, energyScore?: number, attachments?: SessionAttachment[], chapterIds?: string[]) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [feelings, setFeelings] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const contentLabel = timer.mainCategory === 'exercise' ? '\u672c\u6b21\u5b8c\u6210\u76ee\u6807' : timer.mainCategory === 'study' ? '\u672c\u6b21\u5b66\u4e86\u4ec0\u4e48\uff1f' : T.whatDone;
  const availableChapters = timer.mainCategory === 'study' ? studyChapters.filter((chapter) => chapter.projectId === timer.projectId) : [];
  return <Dialog title={T.endTimer} onClose={onClose}><div className="timer-summary"><strong>{timer.projectNameSnapshot}</strong><span>{mainCategoryLabels[timer.mainCategory]} / {getSubCategoryLabel(timer.mainCategory, timer.subCategory)}</span></div><TextArea label={contentLabel} value={content} onChange={setContent} />{timer.mainCategory === 'study' ? <StudyChapterSelector chapters={availableChapters} selectedIds={chapterIds} onChange={setChapterIds} /> : null}<TextArea label={T.feeling} value={feelings} onChange={setFeelings} /><SessionAttachmentPicker attachments={attachments} onChange={setAttachments} /><div className="form-grid"><NumberField label={T.moodScore} value={moodScore} onChange={setMoodScore} /><NumberField label={T.energyScore} value={energyScore} onChange={setEnergyScore} /></div><DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={() => onSave(content, feelings, moodScore, energyScore, attachments, chapterIds)} /></Dialog>;
}

function ManualSessionDialog({ preset, projects, studyChapters, onClose, onCreateProject, onSave }: {
  preset: ManualPreset;
  projects: Project[];
  studyChapters: StudyChapter[];
  onClose: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onSave: (session: Session) => Promise<void>;
}) {
  const [mainCategory, setMainCategory] = useState<MainCategory>(preset.mainCategory ?? 'entertainment');
  const [subCategory, setSubCategory] = useState(preset.subCategory ?? defaultSubCategory[preset.mainCategory ?? 'entertainment']);
  const [projectId, setProjectId] = useState(preset.projectId ?? '');
  const [newName, setNewName] = useState('');
  const [startTime, setStartTime] = useState(toInputDateTime(new Date(Date.now() - 3600000).toISOString()));
  const [endTime, setEndTime] = useState(toInputDateTime());
  const [content, setContent] = useState('');
  const [feelings, setFeelings] = useState('');
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const available = projects.filter((project) => project.mainCategory === mainCategory && project.subCategory === subCategory);
  const availableChapters = mainCategory === 'study' && projectId ? studyChapters.filter((chapter) => chapter.projectId === projectId) : [];
  const contentLabel = mainCategory === 'exercise' ? '\u672c\u6b21\u5b8c\u6210\u76ee\u6807' : mainCategory === 'study' ? '\u672c\u6b21\u5b66\u4e86\u4ec0\u4e48\uff1f' : T.whatDone;
  const changeCategory = (value: MainCategory) => { setMainCategory(value); setSubCategory(defaultSubCategory[value]); setProjectId(''); setChapterIds([]); };
  const submit = async () => {
    if (!mainCategory) { setError(T.noCategoryValidation); return; }
    if (!subCategory) { setError(T.noSubCategoryValidation); return; }
    if (!startTime) { setError(T.noStartValidation); return; }
    if (!endTime) { setError(T.noEndValidation); return; }
    const startIso = fromInputDateTime(startTime);
    const endIso = fromInputDateTime(endTime);
    if (new Date(endIso) < new Date(startIso)) { setError(T.endBeforeStart); return; }
    let project = available.find((item) => item.id === projectId);
    if (!project && newName.trim()) project = await onCreateProject({ name: newName, mainCategory, subCategory, status: 'active' });
    if (!project) { setError(T.noProjectValidation); return; }
    const timestamp = nowIso();
    await onSave({ id: createId(), mainCategory, subCategory, projectId: project.id, projectNameSnapshot: project.name, source: 'manual', startTime: startIso, endTime: endIso, durationMinutes: minutesBetween(startIso, endIso), content, feelings, attachments, chapterIds: chapterIds.length > 0 ? chapterIds : undefined, createdAt: timestamp, updatedAt: timestamp });
  };
  return <Dialog title={T.manualSession} onClose={onClose}><div className="form-grid"><SelectMainCategory value={mainCategory} onChange={changeCategory} /><SelectSubCategory mainCategory={mainCategory} value={subCategory} onChange={(value) => { setSubCategory(value); setProjectId(''); setChapterIds([]); }} /><label><span>{T.startTime}</span><input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label><span>{T.endTime}</span><input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><label className="full-width"><span>{T.project}</span><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setChapterIds([]); }}><option value="">{T.selectProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="full-width"><span>{T.createProject}</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={T.projectPlaceholder} /></label></div><TextArea label={contentLabel} value={content} onChange={setContent} />{mainCategory === 'study' ? <StudyChapterSelector chapters={availableChapters} selectedIds={chapterIds} onChange={setChapterIds} /> : null}<TextArea label={T.feeling} value={feelings} onChange={setFeelings} /><SessionAttachmentPicker attachments={attachments} onChange={setAttachments} />{error ? <p className="error-text">{error}</p> : null}<DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={submit} /></Dialog>;
}

function WeeklyPlanPanel({ projects, plans, onSavePlan, onDeletePlan }: { projects: Project[]; plans: WeeklyPlan[]; onSavePlan: (plan: WeeklyPlan) => Promise<void>; onDeletePlan: (plan: WeeklyPlan) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const effectivePlans = plans.map((plan) => ({ ...plan, status: getEffectivePlanStatus(plan) }));
  return <div><div className="section-heading"><h2>{T.weeklyPlans}</h2><button className="primary-button compact" onClick={() => setCreating(!creating)}>{T.newPlan}</button></div>{creating ? <WeeklyPlanForm projects={projects} onCancel={() => setCreating(false)} onCreate={async (plan) => { await onSavePlan(plan); setCreating(false); }} /> : null}{effectivePlans.length === 0 ? <p className="empty-text">{T.noPlan}</p> : <div className="plan-list">{effectivePlans.map((plan) => <PlanRow key={plan.id} plan={plan} projects={projects} onSavePlan={onSavePlan} onDeletePlan={onDeletePlan} />)}</div>}</div>;
}

function WeeklyPlanForm({ projects, onCancel, onCreate }: { projects: Project[]; onCancel: () => void; onCreate: (plan: WeeklyPlan) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [mainCategory, setMainCategory] = useState<MainCategory | ''>('');
  const [projectId, setProjectId] = useState('');
  const [targetType, setTargetType] = useState<PlanTargetType>('completion');
  const [targetValue, setTargetValue] = useState('');
  const [currentProgress, setCurrentProgress] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');
  const available = mainCategory ? projects.filter((project) => project.mainCategory === mainCategory) : projects;
  const submit = async () => {
    if (!title.trim()) { setError(T.noPlanTitle); return; }
    const project = projects.find((item) => item.id === projectId);
    const timestamp = nowIso();
    await onCreate({ id: createId(), title: title.trim(), mainCategory: mainCategory || project?.mainCategory, subCategory: project?.subCategory, projectId: project?.id, deadline: deadline ? fromInputDateTime(deadline) : undefined, targetType, targetValue: targetValue ? Number(targetValue) : undefined, currentProgress: Number(currentProgress || 0), status: 'active', createdAt: timestamp, updatedAt: timestamp });
  };
  return <div className="inline-form"><div className="form-grid"><label className="full-width"><span>{T.planTitle}</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label><label><span>{T.relatedCategory}</span><select value={mainCategory} onChange={(event) => setMainCategory(event.target.value as MainCategory | '')}><option value="">{T.noRelatedCategory}</option>{mainCategoryOptions.map((category) => <option key={category} value={category}>{mainCategoryLabels[category]}</option>)}</select></label><label><span>{T.relatedProject}</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{T.noRelatedProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>{T.targetType}</span><select value={targetType} onChange={(event) => setTargetType(event.target.value as PlanTargetType)}>{Object.entries(planTargetLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>{T.targetValue}</span><input type="number" value={targetValue} onChange={(event) => setTargetValue(event.target.value)} /></label><label><span>{T.currentProgress}</span><input type="number" value={currentProgress} onChange={(event) => setCurrentProgress(event.target.value)} /></label><label><span>{T.deadline}</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div>{error ? <p className="error-text">{error}</p> : null}<DialogActions onCancel={onCancel} actionLabel={T.savePlan} onAction={submit} /></div>;
}

function PlanRow({ plan, projects, onSavePlan, onDeletePlan }: { plan: WeeklyPlan; projects: Project[]; onSavePlan: (plan: WeeklyPlan) => Promise<void>; onDeletePlan: (plan: WeeklyPlan) => Promise<void> }) {
  const [progress, setProgress] = useState(String(plan.currentProgress));
  const project = projects.find((item) => item.id === plan.projectId);
  return <div className="plan-row"><div><div className="plan-title">{plan.title}</div><div className="meta-line">{plan.mainCategory ? mainCategoryLabels[plan.mainCategory] : T.noRelatedCategory}{project ? ' / ' + project.name : ''}{plan.deadline ? ' / ' + T.deadline + ' ' + formatDate(plan.deadline) : ''}</div></div><div className="plan-controls"><span className={'status-pill ' + plan.status}>{planStatusLabels[plan.status]}</span><input aria-label={T.currentProgress} type="number" min="0" value={progress} onChange={(event) => setProgress(event.target.value)} /><button className="secondary-button compact" onClick={() => onSavePlan({ ...plan, currentProgress: Number(progress || 0) })}>{T.updateProgress}</button><button className="secondary-button compact" onClick={() => onSavePlan({ ...plan, status: 'completed' })}>{T.markCompleted}</button><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'skipped' })}>{T.skip}</button><button className="danger-button compact" onClick={() => onDeletePlan(plan)}>{commonUi.delete}</button></div></div>;
}

function EntertainmentPage({ projects, sessions, images, journalEntries, reminders, activeTimer, onCreateProject, onUpdateProject, onDeleteProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSaveReminder, onDeleteReminder }: {
  projects: Project[];
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  reminders: ProjectReminder[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onUpdateProject: (project: Project) => Promise<void>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onAddImage: (project: Project, data: string, caption?: string) => Promise<void>;
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
  onSaveReminder: (reminder: ProjectReminder) => Promise<void>;
  onDeleteReminder: (reminder: ProjectReminder) => Promise<void>;
}) {
  const [view, setView] = useState<'home' | 'category' | 'project'>('home');
  const [category, setCategory] = useState('game');
  const [selectedId, setSelectedId] = useState('');
  const entertainmentProjects = projects.filter((project) => project.mainCategory === 'entertainment');
  const selectedProject = entertainmentProjects.find((project) => project.id === selectedId);
  const enterCategory = (nextCategory: string) => { setCategory(nextCategory); setSelectedId(''); setView('category'); };
  const enterProject = (id: string) => { setSelectedId(id); setView('project'); };
  const deleteAndLeaveProject = async (project: Project) => { await onDeleteProject(project); setSelectedId(''); setView('category'); };
  if (view === 'project' && selectedProject) {
    return <ProjectDetail project={selectedProject} sessions={sessions.filter((session) => session.projectId === selectedProject.id)} images={images.filter((image) => image.projectId === selectedProject.id)} journalEntries={journalEntries.filter((entry) => entry.projectId === selectedProject.id)} reminders={reminders.filter((reminder) => reminder.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onUpdateProject={onUpdateProject} onDeleteProject={deleteAndLeaveProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onAddImage={onAddImage} onSaveJournalEntry={onSaveJournalEntry} onSaveReminder={onSaveReminder} onDeleteReminder={onDeleteReminder} />;
  }
  if (view === 'category') {
    return <EntertainmentCategoryBoard category={category} projects={entertainmentProjects.filter((project) => project.subCategory === category)} sessions={sessions} reminders={reminders} onBack={() => setView('home')} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onOpenProject={enterProject} />;
  }
  return <EntertainmentHome sessions={sessions} projects={entertainmentProjects} onOpenCategory={enterCategory} />;
}

function EntertainmentHome({ sessions, projects, onOpenCategory }: { sessions: Session[]; projects: Project[]; onOpenCategory: (category: string) => void }) {
  const entertainmentSessions = sessions.filter((session) => session.mainCategory === 'entertainment');
  const totals = summarizeEntertainmentSubCategories(entertainmentSessions);
  const total = Object.values(totals).reduce((sum, minutes) => sum + minutes, 0);
  const topProjects = getTopProjects(projects, sessions, 'entertainment').slice(0, 5);
  return <div className="notion-page entertainment-notion"><section className="notion-hero"><div className="notion-breadcrumb">个人管理系统 / 娱乐</div><h2>娱乐</h2><p>把游戏、动画、漫画和其他娱乐当成一个轻量资料库：先收集项目，再记录时间、感受和提醒。</p><div className="notion-hero-stats"><span>{projects.length} 个项目</span><span>{formatDuration(total)} 总时长</span><span>{entertainmentSessions.length} 条记录</span></div></section><section className="notion-section"><div className="notion-section-title"><h3>娱乐资料库</h3><span>点击分类进入对应 database</span></div><div className="notion-category-grid">{Object.entries(subCategoryLabels.entertainment).map(([key, label]) => { const minutes = totals[key] ?? 0; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; const categoryProjects = projects.filter((project) => project.subCategory === key); const recent = categoryProjects[0]; return <button key={key} className="notion-category-card" onClick={() => onOpenCategory(key)}><div><strong>{label}</strong><span>{categoryProjects.length} 个项目</span></div><p>{recent ? '最近：' + recent.name : '暂无项目'}</p><div className="notion-progress"><div style={{ width: percent + '%' }} /></div><footer><span>{formatDuration(minutes)}</span><em>{percent}%</em></footer></button>; })}</div></section><section className="notion-section"><div className="notion-section-title"><h3>时间分布</h3><span>database summary</span></div><div className="notion-progress-list">{Object.entries(subCategoryLabels.entertainment).map(([key, label]) => { const minutes = totals[key] ?? 0; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; return <div className="notion-progress-row" key={key}><span>{label}</span><div className="notion-progress"><div style={{ width: percent + '%' }} /></div><strong>{formatDuration(minutes)}</strong></div>; })}</div></section><section className="notion-section"><div className="notion-section-title"><h3>高频项目</h3><span>按累计时长排序</span></div><CompactRows rows={topProjects.map((item) => [item.project.name, formatDuration(item.minutes)])} empty={T.noRecords} /></section></div>;
}

function EntertainmentCategoryBoard({ category, projects, sessions, reminders, onBack, onCreateProject, onDeleteProject, onOpenProject }: {
  category: string;
  projects: Project[];
  sessions: Session[];
  reminders: ProjectReminder[];
  onBack: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onOpenProject: (projectId: string) => void;
}) {
  return <div className="notion-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{T.entertainment} / {getSubCategoryLabel('entertainment', category)}</div><h2>{getSubCategoryLabel('entertainment', category)}</h2><p>{'\u50cf Notion database \u4e00\u6837\u7ba1\u7406\u8fd9\u4e2a\u5206\u7c7b\u4e0b\u7684\u9879\u76ee\u3002\u70b9\u51fb\u4efb\u610f\u4e00\u884c\u8fdb\u5165\u9879\u76ee\u7b14\u8bb0\u9875\u3002'}</p></section><EntertainmentProjectForm subCategory={category} onCreateProject={onCreateProject} /><section className="notion-section"><div className="notion-section-title"><h3>{'\u9879\u76ee\u8868\u683c'}</h3><span>{projects.length} {'\u4e2a\u9879\u76ee'}</span></div>{projects.length === 0 ? <p className="empty-text">{T.noProject}</p> : <div className="project-table-wrap notion-table-wrap"><table className="project-table notion-table"><thead><tr><th>{T.project}</th><th>{'\u72b6\u6001'}</th><th>{'\u603b\u65f6\u957f'}</th><th>{'\u6700\u8fd1\u8bb0\u5f55'}</th><th>{'\u63d0\u9192'}</th><th>{'\u6700\u8fd1\u611f\u53d7'}</th><th>{commonUi.action}</th></tr></thead><tbody>{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const total = getProjectTotalMinutes(project.id, sessions); const latest = projectSessions[0]; const projectReminders = reminders.filter((reminder) => reminder.projectId === project.id); const nextReminder = projectReminders.filter((reminder) => reminder.status === 'active').sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0]; const planSummary = nextReminder ? formatDateTime(nextReminder.scheduledAt) + ' / ' + nextReminder.title : projectReminders.length > 0 ? projectReminders.length + ' ' + '\u6761\u63d0\u9192' : '\u6682\u65e0\u63d0\u9192'; return <tr key={project.id} onClick={() => onOpenProject(project.id)}><td><strong>{project.name}</strong><small>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</small></td><td><span className="notion-tag">{projectStatusLabels[project.status]}</span></td><td>{formatDuration(total)}</td><td>{latest ? formatDateTime(latest.startTime) + ' / ' + formatDuration(latest.durationMinutes) : '\u6682\u65e0\u8bb0\u5f55'}</td><td>{planSummary}</td><td>{latest?.feelings || '\u6682\u65e0\u611f\u53d7'}</td><td><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteProject(project); }}>{commonUi.delete}</button></td></tr>; })}</tbody></table></div>}</section></div>;
}

function EntertainmentProjectForm({ subCategory, onCreateProject }: { subCategory: string; onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project> }) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('wishlist');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    if (!name.trim()) { setError(T.noProjectValidation); return; }
    await onCreateProject({ name, mainCategory: 'entertainment', subCategory, status, imageUrl });
    setName(''); setStatus('wishlist'); setImageUrl(''); setError('');
  };
  return <section className="notion-inline-create"><div className="notion-section-title"><h3>新建项目</h3><span>inline database toolbar</span></div><div className="notion-create-row"><label><span>{T.projectName}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={T.projectPlaceholder} /></label><label><span>{T.projectStatus}</span><select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus)}>{projectStatusOptions.map((option) => <option key={option} value={option}>{projectStatusLabels[option]}</option>)}</select></label><label><span>{T.imageUrl}</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} /></label><button className="primary-button" onClick={submit}>{T.createProject}</button></div>{error ? <p className="error-text">{error}</p> : null}</section>;
}

function ProjectDetail({ project, sessions, images, journalEntries, reminders, activeTimer, onBack, onUpdateProject, onDeleteProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSaveReminder, onDeleteReminder }: {
  project?: Project;
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  reminders: ProjectReminder[];
  activeTimer: ActiveTimer | null;
  onBack: () => void;
  onUpdateProject: (project: Project) => Promise<void>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onAddImage: (project: Project, data: string, caption?: string) => Promise<void>;
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
  onSaveReminder: (reminder: ProjectReminder) => Promise<void>;
  onDeleteReminder: (reminder: ProjectReminder) => Promise<void>;
}) {
  const [reminderTime, setReminderTime] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  if (!project) return <div className="detail-panel"><p className="empty-text">{T.chooseOrCreateDetail}</p></div>;
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const latest = sessions[0];
  const nextReminder = reminders.filter((reminder) => reminder.status === 'active').sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  const addReminder = async () => { if (!reminderTime) return; const timestamp = nowIso(); await onSaveReminder({ id: createId(), title: reminderTitle.trim() || '\u8fdb\u884c ' + project.name, mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id, scheduledAt: fromInputDateTime(reminderTime), note: '', status: 'active', createdAt: timestamp, updatedAt: timestamp }); setReminderTime(''); setReminderTitle(''); };
  return <div className="notion-page notion-project-page notebook-project-page"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{T.entertainment} / {getSubCategoryLabel(project.mainCategory, project.subCategory)} / {project.name}</div><h2>{project.name}</h2><div className="notion-properties"><div><span>{'\u72b6\u6001'}</span><select value={project.status} onChange={(event) => onUpdateProject({ ...project, status: event.target.value as ProjectStatus })}>{projectStatusOptions.map((option) => <option key={option} value={option}>{projectStatusLabels[option]}</option>)}</select></div><div><span>{'\u5206\u7c7b'}</span><strong>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</strong></div><div><span>{'\u603b\u65f6\u957f'}</span><strong>{formatDuration(total)}</strong></div><div><span>{'\u6700\u8fd1\u8bb0\u5f55'}</span><strong>{latest ? formatDateTime(latest.startTime) : '\u6682\u65e0\u8bb0\u5f55'}</strong></div><div><span>{'\u4e0b\u6b21\u63d0\u9192'}</span><strong>{nextReminder ? formatDateTime(nextReminder.scheduledAt) : '\u6682\u65e0\u63d0\u9192'}</strong></div></div></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button><label><span>{'\u63d0\u9192\u65f6\u95f4'}</span><input type="datetime-local" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label><label><span>{'\u63d0\u9192\u5185\u5bb9'}</span><input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder={'\u8fdb\u884c ' + project.name} /></label><button className="secondary-button compact" onClick={addReminder}>{'\u4fdd\u5b58\u63d0\u9192'}</button></section>{reminders.length > 0 ? <section className="notion-reminder-list project-reminder-list"><strong>{'\u9879\u76ee\u63d0\u9192'}</strong>{reminders.map((reminder) => <div key={reminder.id} className={'project-reminder-row ' + reminder.status}><span>{formatDateTime(reminder.scheduledAt)} / {reminder.title}</span><button className="danger-button compact" onClick={() => void onDeleteReminder(reminder)}>{commonUi.delete}</button></div>)}</section> : null}<ProjectNotebook project={project} sessions={sessions} journalEntries={journalEntries} onSaveJournalEntry={onSaveJournalEntry} /><section className="notion-block legacy-images"><details><summary>{'\u5386\u53f2\u56fe\u7247'}</summary>{images.length > 0 ? <div className="image-grid">{images.map((image) => <figure key={image.id}><img src={image.data} alt={image.caption || T.projectImages} />{image.caption ? <figcaption>{image.caption}</figcaption> : null}</figure>)}</div> : <p className="empty-text">{'\u6682\u65e0\u5386\u53f2\u56fe\u7247'}</p>}</details></section></div>;
}

function ProjectNotebook({ project, sessions, journalEntries, onSaveJournalEntry }: {
  project: Project;
  sessions: Session[];
  journalEntries: ProjectJournalEntry[];
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
}) {
  const today = toDateKey(new Date());
  const entryByDate = new Map(journalEntries.map((entry) => [entry.date, entry]));
  const dateSet = new Set<string>([today]);
  journalEntries.forEach((entry) => {
    if (hasMeaningfulJournalContent(entry.contentHtml)) dateSet.add(entry.date);
  });
  sessions.forEach((session) => dateSet.add(toDateKey(new Date(session.startTime))));
  const entriesToShow = Array.from(dateSet).sort((a, b) => b.localeCompare(a));

  return (
    <section className="project-notebook paper-notebook" aria-label={'\u9879\u76ee\u65e5\u8bb0'}>
      {entriesToShow.map((date) => {
        const entry = entryByDate.get(date);
        const daySessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === date);
        return <DailyJournalPage key={date} project={project} date={date} entry={entry} sessions={daySessions} onSaveJournalEntry={onSaveJournalEntry} />;
      })}
    </section>
  );
}

function DailyJournalPage({ project, date, entry, sessions, onSaveJournalEntry }: {
  project: Project;
  date: string;
  entry?: ProjectJournalEntry;
  sessions: Session[];
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
}) {
  const [contentHtml, setContentHtml] = useState(stripSessionJournalBlocks(entry?.contentHtml ?? ''));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => setContentHtml(stripSessionJournalBlocks(entry?.contentHtml ?? '')), [entry?.id, entry?.contentHtml, date]);
  useEffect(() => () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); }, []);

  const save = async (nextContentHtml: string) => {
    const cleanHtml = stripSessionJournalBlocks(nextContentHtml);
    if (!hasMeaningfulJournalContent(cleanHtml) && !entry) return;
    setSaveState('saving');
    const timestamp = nowIso();
    await onSaveJournalEntry({ id: entry?.id ?? createId(), projectId: project.id, date, contentHtml: cleanHtml, createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp });
    setSaveState('saved');
  };

  const scheduleSave = (nextContentHtml: string) => {
    const cleanHtml = stripSessionJournalBlocks(nextContentHtml);
    setContentHtml(cleanHtml);
    setSaveState(hasMeaningfulJournalContent(cleanHtml) ? 'saving' : 'idle');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void save(cleanHtml), 700);
  };

  const isToday = date === toDateKey(new Date());

  return (
    <article className="daily-journal-page paper-journal-page">
      <header>
        <h4>{formatJournalDate(date)}</h4>
        <span>{saveState === 'saving' ? '\u6b63\u5728\u81ea\u52a8\u4fdd\u5b58' : saveState === 'saved' ? '\u5df2\u81ea\u52a8\u4fdd\u5b58' : sessions.length > 0 ? sessions.length + ' \u6761\u65f6\u95f4\u8bb0\u5f55' : ''}</span>
      </header>
      <DailySessionSummary sessions={sessions} />
      <NotebookEditor value={contentHtml} onChange={scheduleSave} placeholder={isToday ? '\u4eca\u5929\u8fd8\u6ca1\u6709\u5199\u5185\u5bb9\uff0c\u53ef\u4ee5\u76f4\u63a5\u4ece\u8fd9\u91cc\u5f00\u59cb\u3002\u590d\u5236\u56fe\u7247\u540e\u7c98\u8d34\u5230\u8fd9\u91cc\u4e5f\u53ef\u4ee5\u3002' : '\u53ef\u4ee5\u5728\u8fd9\u91cc\u8865\u5145\u8fd9\u4e00\u5929\u7684\u624b\u5199\u5185\u5bb9\u3002'} />
    </article>
  );
}

function NotebookEditor({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) editorRef.current.innerHTML = value;
  }, [value]);

  const syncContent = () => {
    const editor = editorRef.current;
    if (editor) onChange(editor.innerHTML);
  };

  const insertHtml = (html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand('insertHTML', false, html);
    syncContent();
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const imageFile = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'));
    if (!imageFile) {
      window.setTimeout(syncContent, 0);
      return;
    }

    event.preventDefault();
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') insertHtml('<p><img src="' + reader.result + '" alt="\u7c98\u8d34\u7684\u56fe\u7247" /></p>');
    };
    reader.readAsDataURL(imageFile);
  };

  return (
    <div className="notebook-editor-wrap paper-editor-wrap">
      <div
        ref={editorRef}
        className="notebook-editor paper-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={syncContent}
        onPaste={handlePaste}
        data-placeholder={placeholder}
      />
    </div>
  );
}

function DailySessionSummary({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null;
  return (
    <div className="daily-session-summary">
      <h5>{'\u5f53\u5929\u65f6\u95f4\u8bb0\u5f55'}</h5>
      {sessions.map((session) => (
        <div className="daily-session-card" key={session.id}>
          <div className="daily-session-card-head">
            <strong>{session.projectNameSnapshot}</strong>
            <span>{formatTimeOnly(session.startTime)} - {formatTimeOnly(session.endTime)} / {formatDuration(session.durationMinutes)}</span>
          </div>
          <div className="daily-session-meta">{getCategoryPath(session)} / {session.source === 'timer' ? '\u8ba1\u65f6\u8bb0\u5f55' : '\u624b\u52a8\u8bb0\u5f55'}</div>
          <div className="daily-session-field"><b>{'\u505a\u4e86\u4ec0\u4e48\uff1a'}</b><span>{session.content || '\u672a\u586b\u5199'}</span></div>
          <div className="daily-session-field"><b>{'\u4e8b\u540e\u611f\u53d7\uff1a'}</b><span>{session.feelings || '\u672a\u586b\u5199'}</span></div>
          {(typeof session.moodScore === 'number' || typeof session.energyScore === 'number') ? (
            <div className="daily-session-meta">
              {typeof session.moodScore === 'number' ? '\u5fc3\u60c5 ' + session.moodScore + '/5' : ''}
              {typeof session.moodScore === 'number' && typeof session.energyScore === 'number' ? ' / ' : ''}
              {typeof session.energyScore === 'number' ? '\u7cbe\u529b ' + session.energyScore + '/5' : ''}
            </div>
          ) : null}
          {session.attachments?.length ? <div className="daily-session-images">{session.attachments.map((image) => <img key={image.id} src={image.data} alt={image.caption || '\u672c\u6b21\u56fe\u7247'} />)}</div> : null}
        </div>
      ))}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

function stripSessionJournalBlocks(html: string) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('.journal-session-block').forEach((node) => {
    const keepNodes: Node[] = [];
    let skippedSessionContent = false;
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        if (child.textContent?.trim()) keepNodes.push(child.cloneNode(true));
        return;
      }

      if (!(child instanceof HTMLElement)) return;
      if (child.matches('h5, .journal-session-scores, .journal-session-images')) return;
      if (child.querySelector('strong')?.textContent?.includes('\u4e8b\u540e\u611f\u53d7')) return;
      if (child.tagName.toLowerCase() === 'p' && !skippedSessionContent) {
        skippedSessionContent = true;
        return;
      }
      keepNodes.push(child.cloneNode(true));
    });
    keepNodes.forEach((child) => node.parentNode?.insertBefore(child, node));
    node.remove();
  });

  template.content.querySelectorAll('p, div').forEach((node) => {
    const text = node.textContent?.replace(/\s+/g, '').trim() ?? '';
    if (text.startsWith('\u4e8b\u540e\u611f\u53d7\uff1a') || /^\u5fc3\u60c5\d+\/5\/?\u7cbe\u529b\d+\/5$/.test(text)) node.remove();
  });

  return template.innerHTML.trim();
}

function formatJournalDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return year + '\u5e74' + month + '\u6708' + day + '\u65e5';
}

function formatTimeOnly(value: string) {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function hasMeaningfulJournalContent(html: string) {
  return /<img\b/i.test(html) || html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0;
}


const exerciseSubCategoryLabels: Record<ExerciseSubCategory, string> = {
  strength: '\u529b\u91cf',
  cardio: '\u6709\u6c27',
  other: '\u5176\u4ed6',
};

const exerciseSubCategoryOptions: ExerciseSubCategory[] = ['strength', 'cardio', 'other'];

const exerciseUi = {
  pageTitle: '\u8fd0\u52a8',
  subtitle: '\u628a\u8bad\u7ec3\u3001\u8ba1\u5212\u548c\u6210\u957f\u8bb0\u5f55\u653e\u5728\u4e00\u4e2a\u9875\u9762\u91cc\uff0c\u5148\u7a33\u7a33\u7528\u8d77\u6765\u3002',
  projectUnit: '\u4e2a\u9879\u76ee',
  recordUnit: '\u6b21\u8bb0\u5f55',
  quickStart: '\u5feb\u901f\u5f00\u59cb\u8fd0\u52a8',
  distribution: '\u8fd0\u52a8\u65f6\u95f4\u5206\u5e03',
  projects: '\u8fd0\u52a8\u9879\u76ee',
  detail: '\u9879\u76ee\u60c5\u51b5',
  calendar: '\u8fd0\u52a8\u65e5\u5386',
  plan: '\u8fd0\u52a8\u89c4\u5212',
  growth: '\u4e2a\u4eba\u6210\u957f',
  selectProject: '\u9009\u62e9\u9879\u76ee',
  noProjectOption: '\u5148\u9009\u4e00\u4e2a\u9879\u76ee',
  newProject: '\u65b0\u5efa\u9879\u76ee',
  newProjectPlaceholder: '\u4f8b\u5982\uff1a\u63a8\u65e5\u8bad\u7ec3',
  start: '\u5f00\u59cb\u8fd0\u52a8',
  create: '\u521b\u5efa',
  noProject: '\u6682\u65e0\u9879\u76ee',
  count: '\u603b\u6b21\u6570',
  totalTime: '\u603b\u65f6\u957f',
  averageTime: '\u5e73\u5747\u65f6\u957f',
  latestRecord: '\u6700\u8fd1\u8bb0\u5f55',
  noSelected: '\u5148\u5728\u5de6\u4fa7\u9009\u62e9\u6216\u521b\u5efa\u4e00\u4e2a\u8fd0\u52a8\u9879\u76ee\u3002',
  noDetailRecord: '\u8fd8\u6ca1\u6709\u8fd0\u52a8\u8bb0\u5f55',
  completedGoal: '\u672c\u6b21\u5b8c\u6210\u76ee\u6807',
  feeling: '\u672c\u6b21\u611f\u89c9',
  empty: '\u6682\u65e0',
  previousWeek: '\u4e0a\u4e00\u5468',
  nextWeek: '\u4e0b\u4e00\u5468',
  times: '\u6b21',
  rest: '\u672a\u8fd0\u52a8',
  dayEmpty: '\u8fd9\u5929\u8fd8\u6ca1\u6709\u8fd0\u52a8\u8bb0\u5f55',
  noGoal: '\u672a\u586b\u5199\u5b8c\u6210\u76ee\u6807',
  notificationTitle: '\u8fd0\u52a8\u63d0\u9192',
  notificationOn: '\u8fd0\u52a8\u63d0\u9192\u5df2\u5f00\u542f',
  enableNotification: '\u5f00\u542f\u8fd0\u52a8\u63d0\u9192',
  overduePrefix: '\u6709',
  overdueSuffix: '\u4e2a\u8fd0\u52a8\u5b89\u6392\u5df2\u5230\u65f6',
  planPlaceholder: '\u4f8b\u5982\uff1a\u8dd1\u6b65 30 \u5206\u949f',
  relatedProject: '\u5173\u8054\u9879\u76ee',
  note: '\u5907\u6ce8',
  addPlan: '\u65b0\u589e\u5b89\u6392',
  previousMonth: '\u4e0a\u4e2a\u6708',
  nextMonth: '\u4e0b\u4e2a\u6708',
  done: '\u5b8c\u6210',
  skipped: '\u8df3\u8fc7',
  metricPlaceholder: '\u4f8b\u5982\uff1a\u5367\u63a8',
  unitPlaceholder: '\u5355\u4f4d\uff0c\u4f8b\u5982 kg',
  createMetric: '\u65b0\u5efa\u6210\u957f\u9879',
  noMetric: '\u6682\u65e0\u6210\u957f\u9879\uff0c\u53ef\u4ee5\u5148\u65b0\u5efa\u4e00\u4e2a\u3002',
  from: '\u4ece',
  to: '\u5230',
  improved: '\u63d0\u5347',
  value: '\u6570\u503c',
  addRecord: '\u65b0\u589e\u8bb0\u5f55',
  noGrowthRecord: '\u6682\u65e0\u8bb0\u5f55',
  noNote: '\u65e0\u5907\u6ce8',
  subCategory: '\u7c7b\u578b',
};

function ExercisePage({ projects, sessions, exercisePlans, growthMetrics, growthRecords, activeTimer, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onSaveExercisePlan, onDeleteExercisePlan, onSaveGrowthMetric, onDeleteGrowthMetric, onSaveGrowthRecord, onDeleteGrowthRecord, onSaveSession }: {
  projects: Project[];
  sessions: Session[];
  exercisePlans: ExercisePlan[];
  growthMetrics: GrowthMetric[];
  growthRecords: GrowthRecord[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onSaveExercisePlan: (plan: ExercisePlan) => Promise<void>;
  onDeleteExercisePlan: (plan: ExercisePlan) => Promise<void>;
  onSaveGrowthMetric: (metric: GrowthMetric) => Promise<void>;
  onDeleteGrowthMetric: (metric: GrowthMetric) => Promise<void>;
  onSaveGrowthRecord: (record: GrowthRecord) => Promise<void>;
  onDeleteGrowthRecord: (record: GrowthRecord) => Promise<void>;
  onSaveSession: (session: Session) => Promise<void>;
}) {
  const exerciseProjects = projects.filter((project) => project.mainCategory === 'exercise');
  const exerciseSessions = sessions.filter((session) => session.mainCategory === 'exercise');
  const [view, setView] = useState<'home' | 'category' | 'project'>('home');
  const [category, setCategory] = useState<ExerciseSubCategory>('strength');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const selectedProject = exerciseProjects.find((project) => project.id === selectedProjectId);
  const openCategory = (nextCategory: ExerciseSubCategory) => { setCategory(nextCategory); setSelectedProjectId(''); setView('category'); };
  const openProject = (projectId: string) => {
    const project = exerciseProjects.find((item) => item.id === projectId);
    if (!project) return;
    setCategory(project.subCategory as ExerciseSubCategory);
    setSelectedProjectId(project.id);
    setView('project');
  };
  const deleteAndLeaveProject = async (project: Project) => { await onDeleteProject(project); setSelectedProjectId(''); setView('category'); };

  useEffect(() => {
    if (selectedProjectId && !exerciseProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId('');
      if (view === 'project') setView('category');
    }
  }, [selectedProjectId, exerciseProjects, view]);

  if (view === 'project' && selectedProject) {
    return <ExerciseProjectPage project={selectedProject} sessions={exerciseSessions.filter((session) => session.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onDeleteProject={deleteAndLeaveProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onSaveSession={onSaveSession} />;
  }

  if (view === 'category') {
    return <ExerciseCategoryBoard category={category} projects={exerciseProjects.filter((project) => project.subCategory === category)} sessions={exerciseSessions} activeTimer={activeTimer} onBack={() => setView('home')} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onOpenProject={openProject} />;
  }

  return (
    <div className="exercise-page exercise-home-page">
      <section className="exercise-hero panel">
        <div>
          <p className="eyebrow">{T.stage}</p>
          <h2>{exerciseUi.pageTitle}</h2>
          <p>{exerciseUi.subtitle}</p>
        </div>
        <div className="exercise-hero-stats">
          <span>{exerciseProjects.length} {exerciseUi.projectUnit}</span>
          <span>{exerciseSessions.length} {exerciseUi.recordUnit}</span>
          <span>{formatDuration(exerciseSessions.reduce((sum, session) => sum + session.durationMinutes, 0))}</span>
        </div>
      </section>

      <section className="panel exercise-category-entry-panel">
        <h2>{exerciseUi.projects}</h2>
        <ExerciseCategoryEntrances projects={exerciseProjects} sessions={exerciseSessions} onOpenCategory={openCategory} />
      </section>

      <section className="panel exercise-distribution-panel">
        <h2>{exerciseUi.distribution}</h2>
        <ExerciseTimeDistribution sessions={exerciseSessions} />
      </section>

      <section className="panel exercise-calendar-panel">
        <h2>{exerciseUi.calendar}</h2>
        <ExerciseMonthCalendar sessions={exerciseSessions} onOpenProject={openProject} />
      </section>

      <section className="panel exercise-plan-panel-wrap">
        <h2>{exerciseUi.plan}</h2>
        <ExercisePlanPanel projects={exerciseProjects} plans={exercisePlans} onSavePlan={onSaveExercisePlan} onDeletePlan={onDeleteExercisePlan} />
      </section>

      <section className="panel exercise-growth-panel-wrap">
        <h2>{exerciseUi.growth}</h2>
        <GrowthPanel metrics={growthMetrics} records={growthRecords} onSaveMetric={onSaveGrowthMetric} onDeleteMetric={onDeleteGrowthMetric} onSaveRecord={onSaveGrowthRecord} onDeleteRecord={onDeleteGrowthRecord} />
      </section>
    </div>
  );
}

function ExerciseCategoryEntrances({ projects, sessions, onOpenCategory }: { projects: Project[]; sessions: Session[]; onOpenCategory: (category: ExerciseSubCategory) => void }) {
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  return <div className="exercise-category-entrances">{exerciseSubCategoryOptions.map((category) => { const categoryProjects = projects.filter((project) => project.subCategory === category); const categorySessions = sessions.filter((session) => session.subCategory === category); const minutes = categorySessions.reduce((sum, session) => sum + session.durationMinutes, 0); const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; const recent = categoryProjects[0]; return <button key={category} className={'exercise-category-entry ' + category} onClick={() => onOpenCategory(category)}><div><strong>{exerciseSubCategoryLabels[category]}</strong><span>{categoryProjects.length} {'\u4e2a\u9879\u76ee'}</span></div><p>{recent ? '\u6700\u8fd1\uff1a' + recent.name : '\u6682\u65e0\u9879\u76ee'}</p><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><footer><span>{formatDuration(minutes)}</span><em>{percent}%</em></footer></button>; })}</div>;
}

function ExerciseCategoryBoard({ category, projects, sessions, activeTimer, onBack, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onOpenProject }: {
  category: ExerciseSubCategory;
  projects: Project[];
  sessions: Session[];
  activeTimer: ActiveTimer | null;
  onBack: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onOpenProject: (projectId: string) => void;
}) {
  return <div className="notion-page exercise-category-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{exerciseUi.pageTitle} / {exerciseSubCategoryLabels[category]}</div><h2>{exerciseSubCategoryLabels[category]}</h2><p>{'\u8fd9\u91cc\u53ea\u653e\u8fd9\u4e2a\u8fd0\u52a8\u7c7b\u578b\u4e0b\u7684\u9879\u76ee\uff0c\u70b9\u51fb\u9879\u76ee\u8fdb\u5165\u8be6\u60c5\u9875\u3002'}</p></section><section className="panel exercise-projects-panel category-projects-panel"><ExerciseProjectLibrary projects={projects} sessions={sessions} selectedProjectId="" activeTimer={activeTimer} onOpenProject={onOpenProject} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} singleCategory={category} /></section></div>;
}

function ExerciseProjectPage({ project, sessions, activeTimer, onBack, onDeleteProject, onStartTimer, onManualSession, onSaveSession }: { project: Project; sessions: Session[]; activeTimer: ActiveTimer | null; onBack: () => void; onDeleteProject: (project: Project) => Promise<void>; onStartTimer: (project: Project) => Promise<void>; onManualSession: (preset: ManualPreset) => void; onSaveSession: (session: Session) => Promise<void> }) {
  return <div className="notion-page exercise-project-page"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{exerciseUi.pageTitle} / {exerciseSubCategoryLabels[project.subCategory as ExerciseSubCategory]} / {project.name}</div><h2>{project.name}</h2></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: 'exercise', subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button></section><section className="panel"><ExerciseProjectDetail project={project} sessions={sessions} onSaveSession={onSaveSession} /></section></div>;
}

function ExerciseQuickStart({ projects, activeTimer, onStartTimer, onCreateProject }: { projects: Project[]; activeTimer: ActiveTimer | null; onStartTimer: (project: Project) => Promise<void>; onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project> }) {
  const [subCategory, setSubCategory] = useState<ExerciseSubCategory>('strength');
  const [projectId, setProjectId] = useState('');
  const [newName, setNewName] = useState('');
  const available = projects.filter((project) => project.subCategory === subCategory);
  const start = async () => {
    let project = available.find((item) => item.id === projectId);
    if (!project && newName.trim()) project = await onCreateProject({ name: newName.trim(), mainCategory: 'exercise', subCategory, status: 'active' });
    if (!project) return;
    await onStartTimer(project);
    setNewName('');
  };
  return <div className="exercise-quick-start"><SelectExerciseSubCategory value={subCategory} onChange={(value) => { setSubCategory(value); setProjectId(''); }} /><label><span>{exerciseUi.selectProject}</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{exerciseUi.noProjectOption}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label><span>{exerciseUi.newProject}</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={exerciseUi.newProjectPlaceholder} /></label><button className="primary-button" disabled={Boolean(activeTimer)} onClick={start}>{exerciseUi.start}</button></div>;
}

function ExerciseProjectLibrary({ projects, sessions, selectedProjectId, activeTimer, onOpenProject, onCreateProject, onDeleteProject, onStartTimer, onManualSession, singleCategory }: {
  projects: Project[];
  sessions: Session[];
  selectedProjectId: string;
  activeTimer: ActiveTimer | null;
  onOpenProject: (id: string) => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  singleCategory?: ExerciseSubCategory;
}) {
  const categories = singleCategory ? [singleCategory] : exerciseSubCategoryOptions;
  return <div className="exercise-project-library">{categories.map((category) => <ExerciseProjectSection key={category} category={category} projects={projects.filter((project) => project.subCategory === category)} sessions={sessions} selectedProjectId={selectedProjectId} activeTimer={activeTimer} onOpenProject={onOpenProject} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} />)}</div>;
}

function ExerciseProjectSection({ category, projects, sessions, selectedProjectId, activeTimer, onOpenProject, onCreateProject, onDeleteProject, onStartTimer, onManualSession }: {
  category: ExerciseSubCategory;
  projects: Project[];
  sessions: Session[];
  selectedProjectId: string;
  activeTimer: ActiveTimer | null;
  onOpenProject: (id: string) => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
}) {
  const [name, setName] = useState('');
  const create = async () => {
    if (!name.trim()) return;
    const project = await onCreateProject({ name: name.trim(), mainCategory: 'exercise', subCategory: category, status: 'active' });
    setName('');
    onOpenProject(project.id);
  };
  return <div className="exercise-project-section"><div className="section-heading"><h3>{exerciseSubCategoryLabels[category]}</h3></div><div className="inline-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={exerciseUi.newProjectPlaceholder} /><button className="secondary-button compact" onClick={create}>{exerciseUi.create}</button></div>{projects.length === 0 ? <p className="empty-text">{exerciseUi.noProject}</p> : <div className="exercise-project-list">{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const total = projectSessions.reduce((sum, session) => sum + session.durationMinutes, 0); return <article key={project.id} className={project.id === selectedProjectId ? 'exercise-project-card active' : 'exercise-project-card'} onClick={() => onOpenProject(project.id)}><strong>{project.name}</strong><span>{projectSessions.length} {exerciseUi.times} / {formatDuration(total)}</span><div className="exercise-card-actions"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={(event) => { event.stopPropagation(); void onStartTimer(project); }}>{T.startTimer}</button><button className="secondary-button compact" onClick={(event) => { event.stopPropagation(); onManualSession({ mainCategory: 'exercise', subCategory: category, projectId: project.id }); }}>{T.manualSession}</button><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteProject(project); }}>{commonUi.delete}</button></div></article>; })}</div>}</div>;
}

function ExerciseProjectDetail({ project, sessions, onSaveSession }: { project?: Project; sessions: Session[]; onSaveSession: (session: Session) => Promise<void> }) {
  if (!project) return <p className="empty-text">{exerciseUi.noSelected}</p>;
  const orderedSessions = [...sessions].sort((a, b) => b.startTime.localeCompare(a.startTime));
  const total = orderedSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const average = orderedSessions.length > 0 ? Math.round(total / orderedSessions.length) : 0;
  return <div className="exercise-detail"><div className="exercise-detail-stats"><div><span>{exerciseUi.count}</span><strong>{orderedSessions.length} {exerciseUi.times}</strong></div><div><span>{exerciseUi.totalTime}</span><strong>{formatDuration(total)}</strong></div><div><span>{exerciseUi.averageTime}</span><strong>{formatDuration(average)}</strong></div><div><span>{exerciseUi.latestRecord}</span><strong>{orderedSessions[0] ? formatDateTime(orderedSessions[0].startTime) : exerciseUi.empty}</strong></div></div><h3>{project.name}</h3>{orderedSessions.length === 0 ? <p className="empty-text">{exerciseUi.noDetailRecord}</p> : <div className="exercise-session-list">{orderedSessions.map((session) => <ExerciseSessionCard key={session.id} session={session} onSaveSession={onSaveSession} />)}</div>}</div>;
}

function ExerciseSessionCard({ session, onSaveSession }: { session: Session; onSaveSession: (session: Session) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [supplement, setSupplement] = useState(session.supplement ?? '');
  useEffect(() => { setSupplement(session.supplement ?? ''); }, [session.id, session.supplement]);
  const saveSupplement = async () => {
    await onSaveSession({ ...session, supplement: supplement.trim(), updatedAt: nowIso() });
    setEditing(false);
  };
  return <article className="exercise-session-card"><div className="daily-session-card-head"><strong>{formatDateTime(session.startTime)} - {formatDateTime(session.endTime)}</strong><span>{formatDuration(session.durationMinutes)}</span></div><div className="daily-session-field"><b>{exerciseUi.completedGoal}</b><span>{session.content || exerciseUi.empty}</span></div><div className="daily-session-field"><b>{exerciseUi.feeling}</b><span>{session.feelings || exerciseUi.empty}</span></div>{session.supplement ? <div className="daily-session-field"><b>{'\u4e8b\u540e\u8865\u5145'}</b><span>{session.supplement}</span></div> : null}{(typeof session.moodScore === 'number' || typeof session.energyScore === 'number') ? <div className="daily-session-meta">{typeof session.moodScore === 'number' ? T.moodScore + ' ' + session.moodScore + '/5' : ''}{typeof session.moodScore === 'number' && typeof session.energyScore === 'number' ? ' / ' : ''}{typeof session.energyScore === 'number' ? T.energyScore + ' ' + session.energyScore + '/5' : ''}</div> : null}{session.attachments?.length ? <div className="daily-session-images">{session.attachments.map((image) => <img key={image.id} src={image.data} alt={exerciseUi.completedGoal} />)}</div> : null}{editing ? <div className="exercise-supplement-editor"><textarea value={supplement} onChange={(event) => setSupplement(event.target.value)} placeholder={'\u5199\u4e00\u70b9\u4e8b\u540e\u8865\u5145'} rows={3} /><div><button className="primary-button compact" onClick={saveSupplement}>{'\u4fdd\u5b58\u8865\u5145'}</button><button className="ghost-button compact" onClick={() => { setSupplement(session.supplement ?? ''); setEditing(false); }}>{T.cancel}</button></div></div> : <button className="secondary-button compact exercise-supplement-button" onClick={() => setEditing(true)}>{session.supplement ? '\u7f16\u8f91\u8865\u5145' : '\u8865\u5145'}</button>}</article>;
}

function ExerciseMonthCalendar({ sessions, onOpenProject }: { sessions: Session[]; onOpenProject: (id: string) => void }) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const cells = buildExerciseMonthCells(monthCursor);
  const selectedSessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === selectedDate);
  return <div className="exercise-calendar exercise-month-calendar"><div className="calendar-toolbar"><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>{exerciseUi.previousMonth}</button><strong>{monthCursor.getFullYear()}{'\u5e74'}{monthCursor.getMonth() + 1}{'\u6708'}</strong><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>{exerciseUi.nextMonth}</button></div><div className="exercise-month-weekdays">{['\u5468\u4e00','\u5468\u4e8c','\u5468\u4e09','\u5468\u56db','\u5468\u4e94','\u5468\u516d','\u5468\u65e5'].map((day) => <span key={day}>{day}</span>)}</div><div className="exercise-month-grid">{cells.map((date, index) => { if (!date) return <span key={'empty-' + index} className="exercise-month-empty" />; const key = toDateKey(date); const daySessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === key); const marker = getExerciseDayMarker(daySessions); return <button key={key} className={'exercise-month-day ' + marker + (selectedDate === key ? ' selected' : '')} onClick={() => setSelectedDate(key)}><strong>{date.getDate()}</strong>{daySessions.length > 0 ? <span>{daySessions.length} {exerciseUi.times}</span> : <em>{exerciseUi.rest}</em>}</button>; })}</div><div className="selected-exercise-day"><h3>{selectedDate}</h3>{selectedSessions.length === 0 ? <p className="empty-text">{exerciseUi.dayEmpty}</p> : selectedSessions.map((session) => <button className="exercise-day-record" key={session.id} onClick={() => onOpenProject(session.projectId)}><strong>{session.projectNameSnapshot}</strong><span>{exerciseSubCategoryLabels[session.subCategory as ExerciseSubCategory] ?? session.subCategory} / {formatDuration(session.durationMinutes)}</span><em>{session.content || exerciseUi.noGoal}</em></button>)}</div></div>;
}

function ExercisePlanPanel({ projects, plans, onSavePlan, onDeletePlan }: { projects: Project[]; plans: ExercisePlan[]; onSavePlan: (plan: ExercisePlan) => Promise<void>; onDeletePlan: (plan: ExercisePlan) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [subCategory, setSubCategory] = useState<ExerciseSubCategory>('strength');
  const [projectId, setProjectId] = useState('');
  const [scheduledAt, setScheduledAt] = useState(toInputDateTime());
  const [note, setNote] = useState('');
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [notificationEnabled, setNotificationEnabled] = useState(() => typeof Notification !== 'undefined' && Notification.permission === 'granted');
  const [notifiedIds, setNotifiedIds] = useState<string[]>([]);
  const available = projects.filter((project) => project.subCategory === subCategory);
  const monthPlans = plans.filter((plan) => { const date = new Date(plan.scheduledAt); return date.getFullYear() === monthCursor.getFullYear() && date.getMonth() === monthCursor.getMonth(); });
  const duePlans = plans.filter((plan) => plan.status === 'active' && new Date(plan.scheduledAt).getTime() <= Date.now());

  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      plans.filter((plan) => plan.status === 'active' && new Date(plan.scheduledAt).getTime() <= Date.now()).forEach((plan) => {
        if (notifiedIds.includes(plan.id)) return;
        new Notification(exerciseUi.notificationTitle, { body: plan.title + ' / ' + formatDateTime(plan.scheduledAt) });
        setNotifiedIds((current) => [...current, plan.id]);
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [plans, notifiedIds]);

  const requestNotification = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotificationEnabled(result === 'granted');
  };
  const create = async () => {
    if (!title.trim() || !scheduledAt) return;
    const timestamp = nowIso();
    await onSavePlan({ id: createId(), title: title.trim(), mainCategory: 'exercise', subCategory, projectId: projectId || undefined, scheduledAt: fromInputDateTime(scheduledAt), note, status: 'active', createdAt: timestamp, updatedAt: timestamp });
    setTitle(''); setProjectId(''); setNote('');
  };

  return <div className="exercise-plan-panel"><div className="notification-row">{notificationEnabled ? <span className="status-pill active">{exerciseUi.notificationOn}</span> : <button className="secondary-button compact" onClick={requestNotification}>{exerciseUi.enableNotification}</button>}{duePlans.length > 0 ? <span className="warning-text">{exerciseUi.overduePrefix} {duePlans.length} {exerciseUi.overdueSuffix}</span> : null}</div><div className="exercise-plan-form"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={exerciseUi.planPlaceholder} /><SelectExerciseSubCategory value={subCategory} onChange={(value) => { setSubCategory(value); setProjectId(''); }} /><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{exerciseUi.relatedProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={exerciseUi.note} /><button className="primary-button" onClick={create}>{exerciseUi.addPlan}</button></div><div className="calendar-toolbar"><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>{exerciseUi.previousMonth}</button><strong>{monthCursor.getFullYear()}{'\u5e74'}{monthCursor.getMonth() + 1}{'\u6708'}</strong><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>{exerciseUi.nextMonth}</button></div><div className="exercise-plan-month">{buildMonthCells(monthCursor).map((date, index) => date ? <div key={toDateKey(date)} className="exercise-plan-day"><strong>{date.getDate()}</strong>{monthPlans.filter((plan) => toDateKey(new Date(plan.scheduledAt)) === toDateKey(date)).map((plan) => <div key={plan.id} className={'exercise-plan-item ' + plan.status}><span>{formatDateTime(plan.scheduledAt)} {plan.title}</span><small>{exerciseSubCategoryLabels[plan.subCategory]}</small>{plan.note ? <small>{plan.note}</small> : null}<div><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'done' })}>{exerciseUi.done}</button><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'skipped' })}>{exerciseUi.skipped}</button><button className="danger-button compact" onClick={() => onDeletePlan(plan)}>{commonUi.delete}</button></div></div>)}</div> : <div key={'empty-' + index} className="exercise-plan-day empty" />)}</div></div>;
}

function GrowthPanel({ metrics, records, onSaveMetric, onDeleteMetric, onSaveRecord, onDeleteRecord }: { metrics: GrowthMetric[]; records: GrowthRecord[]; onSaveMetric: (metric: GrowthMetric) => Promise<void>; onDeleteMetric: (metric: GrowthMetric) => Promise<void>; onSaveRecord: (record: GrowthRecord) => Promise<void>; onDeleteRecord: (record: GrowthRecord) => Promise<void> }) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [selectedMetricId, setSelectedMetricId] = useState(metrics[0]?.id ?? '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { if (!selectedMetricId && metrics[0]) setSelectedMetricId(metrics[0].id); if (selectedMetricId && !metrics.some((metric) => metric.id === selectedMetricId)) setSelectedMetricId(metrics[0]?.id ?? ''); }, [metrics, selectedMetricId]);
  const selectedMetric = metrics.find((metric) => metric.id === selectedMetricId);
  const metricRecords = records.filter((record) => record.metricId === selectedMetricId).sort((a, b) => b.date.localeCompare(a.date));
  const createMetric = async () => {
    if (!name.trim() || !unit.trim()) return;
    const timestamp = nowIso();
    const metric = { id: createId(), name: name.trim(), unit: unit.trim(), createdAt: timestamp, updatedAt: timestamp };
    await onSaveMetric(metric);
    setSelectedMetricId(metric.id); setName('');
  };
  const createRecord = async () => {
    if (!selectedMetric || !date || !value) return;
    const timestamp = nowIso();
    await onSaveRecord({ id: createId(), metricId: selectedMetric.id, date, value: Number(value), note, createdAt: timestamp, updatedAt: timestamp });
    setValue(''); setNote('');
  };
  const oldest = [...metricRecords].sort((a, b) => a.date.localeCompare(b.date))[0];
  const newest = metricRecords[0];
  return <div className="growth-panel"><div className="growth-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={exerciseUi.metricPlaceholder} /><input value={unit} onChange={(event) => setUnit(event.target.value)} placeholder={exerciseUi.unitPlaceholder} /><button className="secondary-button" onClick={createMetric}>{exerciseUi.createMetric}</button></div>{metrics.length === 0 ? <p className="empty-text">{exerciseUi.noMetric}</p> : <div className="growth-grid"><aside className="growth-metrics">{metrics.map((metric) => <div key={metric.id} className={metric.id === selectedMetricId ? 'growth-metric-row active' : 'growth-metric-row'}><button onClick={() => setSelectedMetricId(metric.id)}>{metric.name}<span>{metric.unit}</span></button><button className="danger-button compact" onClick={() => void onDeleteMetric(metric)}>{commonUi.delete}</button></div>)}</aside><section className="growth-records"><h3>{selectedMetric?.name}</h3>{oldest && newest ? <p className="muted">{exerciseUi.from} {oldest.value}{selectedMetric?.unit} {exerciseUi.to} {newest.value}{selectedMetric?.unit}{'\uff0c'}{exerciseUi.improved} {newest.value - oldest.value}{selectedMetric?.unit}</p> : null}<div className="growth-record-form"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /><input type="number" value={value} onChange={(event) => setValue(event.target.value)} placeholder={exerciseUi.value} /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={exerciseUi.note} /><button className="primary-button" onClick={createRecord}>{exerciseUi.addRecord}</button></div>{metricRecords.length === 0 ? <p className="empty-text">{exerciseUi.noGrowthRecord}</p> : <div className="growth-record-list">{metricRecords.map((record) => <div key={record.id}><strong>{record.date}</strong><span>{record.value}{selectedMetric?.unit}</span><em>{record.note || exerciseUi.noNote}</em><button className="danger-button compact" onClick={() => void onDeleteRecord(record)}>{commonUi.delete}</button></div>)}</div>}</section></div>}</div>;
}

function ExerciseTimeDistribution({ sessions }: { sessions: Session[] }) {
  const totals = exerciseSubCategoryOptions.reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as Record<ExerciseSubCategory, number>);
  sessions.forEach((session) => { const key = session.subCategory as ExerciseSubCategory; if (key in totals) totals[key] += session.durationMinutes; });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const colors: Record<ExerciseSubCategory, string> = { strength: '#c94c4c', cardio: '#3977c9', other: '#3b9b60' };
  let cursor = 0;
  const pieSegments = exerciseSubCategoryOptions.map((category) => {
    const value = totals[category];
    if (value <= 0 || total <= 0) return '';
    const start = cursor;
    const end = cursor + (value / total) * 100;
    cursor = end;
    return colors[category] + ' ' + start + '% ' + end + '%';
  }).filter(Boolean).join(', ');
  return <div className="exercise-distribution"><div className="exercise-progress-list">{exerciseSubCategoryOptions.map((category) => { const minutes = totals[category]; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; return <div className="exercise-progress-row" key={category}><span>{exerciseSubCategoryLabels[category]}</span><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><strong>{formatDuration(minutes)} / {percent}%</strong></div>; })}</div><div className="exercise-pie-summary"><div className="exercise-pie-chart" style={{ background: total > 0 ? 'conic-gradient(' + pieSegments + ')' : '#e8efeb' }}><span>{total > 0 ? formatDuration(total) : '0\u5206\u949f'}</span></div><div className="exercise-pie-legend">{exerciseSubCategoryOptions.map((category) => <div key={category}><i style={{ background: colors[category] }} /><span>{exerciseSubCategoryLabels[category]}</span><strong>{formatDuration(totals[category])}</strong></div>)}</div>{total === 0 ? <p className="empty-text">{commonUi.noExerciseData}</p> : null}</div></div>;
}

const studySubCategoryLabels: Record<StudySubCategory, string> = {
  computer: '\u8ba1\u7b97\u673a',
  math: '\u6570\u5b66',
  english: '\u82f1\u8bed',
  other: '\u5176\u4ed6',
};

const studySubCategoryOptions: StudySubCategory[] = ['computer', 'math', 'english', 'other'];

const studyUi = {
  pageTitle: '\u5b66\u4e60',
  subtitle: '\u628a\u8ba1\u7b97\u673a\u3001\u6570\u5b66\u3001\u82f1\u8bed\u548c\u5176\u4ed6\u5b66\u4e60\u9879\u76ee\u7edf\u4e00\u6536\u7eb3\uff0c\u8bb0\u5f55\u65f6\u95f4\u3001\u7ae0\u8282\u3001\u9519\u9898\u548c\u7b14\u8bb0\u3002',
  projects: '\u5b66\u4e60\u9879\u76ee',
  distribution: '\u5b66\u4e60\u65f6\u95f4\u5206\u5e03',
  calendar: '\u5b66\u4e60\u65e5\u5386',
  mistakes: '\u9519\u9898\u5e93',
  notes: '\u7b14\u8bb0\u5e93',
  projectUnit: '\u4e2a\u9879\u76ee',
  recordUnit: '\u6761\u8bb0\u5f55',
  noProject: '\u6682\u65e0\u9879\u76ee',
  create: '\u521b\u5efa',
  newProjectPlaceholder: '\u4f8b\u5982\uff1a\u6570\u636e\u7ed3\u6784',
  times: '\u6b21',
  count: '\u603b\u6b21\u6570',
  totalTime: '\u603b\u65f6\u957f',
  averageTime: '\u5e73\u5747\u65f6\u957f',
  latestRecord: '\u6700\u8fd1\u8bb0\u5f55',
  empty: '\u6682\u65e0',
  hierarchy: '\u5b66\u4e60\u5c42\u6b21\u8868',
  chapterPlaceholder: '\u4f8b\u5982\uff1a\u94fe\u8868',
  addChapter: '\u65b0\u589e\u7ae0\u8282',
  completed: '\u5df2\u5b66\u5b8c',
  notStarted: '\u672a\u5b66\u5b8c',
  relatedChapters: '\u5173\u8054\u77e5\u8bc6\u7ae0\u8282',
  noChapters: '\u8fd9\u4e2a\u9879\u76ee\u8fd8\u6ca1\u6709\u77e5\u8bc6\u7ae0\u8282',
  learnedContent: '\u5b66\u4e60\u5185\u5bb9',
  feeling: '\u672c\u6b21\u611f\u89c9',
  previousMonth: '\u4e0a\u4e2a\u6708',
  nextMonth: '\u4e0b\u4e2a\u6708',
  rest: '\u672a\u5b66\u4e60',
  dayEmpty: '\u8fd9\u4e00\u5929\u8fd8\u6ca1\u6709\u5b66\u4e60\u8bb0\u5f55',
  title: '\u6807\u9898',
  content: '\u5185\u5bb9',
  imageUrl: '\u56fe\u7247\u7f51\u5740',
  uploadImage: '\u4e0a\u4f20\u56fe\u7247',
  saveMistake: '\u4fdd\u5b58\u9519\u9898',
  saveNote: '\u4fdd\u5b58\u7b14\u8bb0',
  noLibraryItem: '\u6682\u65e0\u5185\u5bb9',
  openLibrary: '\u8fdb\u5165\u8d44\u6599\u5e93',
  libraryDatabase: '\u8d44\u6599\u5e93',
  newItem: '\u65b0\u5efa\u6761\u76ee',
  recordTime: '\u8bb0\u5f55\u65f6\u95f4',
  updatedAt: '\u66f4\u65b0\u65f6\u95f4',
  relatedProject: '\u5173\u8054\u9879\u76ee',
  image: '\u56fe\u7247',
  saveContent: '\u4fdd\u5b58\u5185\u5bb9',
  backToLibrary: '\u8fd4\u56de\u8d44\u6599\u5e93',
  paperHint: '\u5728\u8fd9\u5f20\u767d\u7eb8\u4e0a\u8bb0\u5f55\u6587\u5b57\u3001\u56fe\u7247\u548c\u590d\u76d8\u3002',
  reviewReminder: '\u590d\u4e60\u63d0\u9192',
  reminderTime: '\u63d0\u9192\u65f6\u95f4',
  reminderNote: '\u63d0\u9192\u5185\u5bb9',
  saveReminder: '\u4fdd\u5b58\u63d0\u9192',
  clearReminder: '\u6e05\u9664\u63d0\u9192',
  markReviewed: '\u5b8c\u6210\u590d\u4e60',
  enableStudyReminder: '\u5f00\u542f\u5b66\u4e60\u63d0\u9192',
  reminderOn: '\u5b66\u4e60\u63d0\u9192\u5df2\u5f00\u542f',
  reminderPlaceholder: '\u4f8b\u5982\uff1a6\u670829\u65e5\u590d\u4e60\u94fe\u8868',
};

function StudyPage({ projects, sessions, studyChapters, studyLibraryItems, studyLibraryPlans, activeTimer, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onSaveChapter, onDeleteChapter, onSaveLibraryItem, onDeleteLibraryItem, onSaveLibraryPlan }: {
  projects: Project[];
  sessions: Session[];
  studyChapters: StudyChapter[];
  studyLibraryItems: StudyLibraryItem[];
  studyLibraryPlans: StudyLibraryPlan[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onSaveChapter: (chapter: StudyChapter) => Promise<void>;
  onDeleteChapter: (chapter: StudyChapter) => Promise<void>;
  onSaveLibraryItem: (item: StudyLibraryItem) => Promise<void>;
  onDeleteLibraryItem: (item: StudyLibraryItem) => Promise<void>;
  onSaveLibraryPlan: (plan: StudyLibraryPlan) => Promise<void>;
}) {
  const studyProjects = projects.filter((project) => project.mainCategory === 'study');
  const studySessions = sessions.filter((session) => session.mainCategory === 'study');
  const [view, setView] = useState<'home' | 'category' | 'project' | 'library' | 'libraryItem'>('home');
  const [category, setCategory] = useState<StudySubCategory>('computer');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [libraryType, setLibraryType] = useState<StudyLibraryType>('mistake');
  const [selectedLibraryItemId, setSelectedLibraryItemId] = useState('');
  const selectedProject = studyProjects.find((project) => project.id === selectedProjectId);
  const selectedLibraryItem = studyLibraryItems.find((item) => item.id === selectedLibraryItemId);
  const openCategory = (nextCategory: StudySubCategory) => { setCategory(nextCategory); setSelectedProjectId(''); setView('category'); };
  const openProject = (projectId: string) => {
    const project = studyProjects.find((item) => item.id === projectId);
    if (!project) return;
    setCategory(project.subCategory as StudySubCategory);
    setSelectedProjectId(project.id);
    setView('project');
  };
  const openLibrary = (type: StudyLibraryType) => { setLibraryType(type); setSelectedLibraryItemId(''); setView('library'); };
  const openLibraryItem = (itemId: string) => { setSelectedLibraryItemId(itemId); setView('libraryItem'); };
  const deleteAndLeaveProject = async (project: Project) => { await onDeleteProject(project); setSelectedProjectId(''); setView('category'); };

  useEffect(() => {
    if (selectedProjectId && !studyProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId('');
      if (view === 'project') setView('category');
    }
  }, [selectedProjectId, studyProjects, view]);

  useEffect(() => {
    if (selectedLibraryItemId && !studyLibraryItems.some((item) => item.id === selectedLibraryItemId)) {
      setSelectedLibraryItemId('');
      if (view === 'libraryItem') setView('library');
    }
  }, [selectedLibraryItemId, studyLibraryItems, view]);

  if (view === 'project' && selectedProject) {
    return <StudyProjectPage project={selectedProject} sessions={studySessions.filter((session) => session.projectId === selectedProject.id)} chapters={studyChapters.filter((chapter) => chapter.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onDeleteProject={deleteAndLeaveProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onSaveChapter={onSaveChapter} onDeleteChapter={onDeleteChapter} />;
  }
  if (view === 'category') {
    return <StudyCategoryBoard category={category} projects={studyProjects.filter((project) => project.subCategory === category)} sessions={studySessions} activeTimer={activeTimer} onBack={() => setView('home')} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onOpenProject={openProject} />;
  }
  if (view === 'library') {
    return <StudyLibraryDatabasePage type={libraryType} projects={studyProjects} items={studyLibraryItems.filter((item) => item.type === libraryType)} plans={studyLibraryPlans.filter((plan) => plan.type === libraryType)} onBack={() => setView('home')} onOpenItem={openLibraryItem} onSaveItem={onSaveLibraryItem} onDeleteItem={onDeleteLibraryItem} onSavePlan={onSaveLibraryPlan} />;
  }
  if (view === 'libraryItem' && selectedLibraryItem) {
    return <StudyLibraryPaperPage item={selectedLibraryItem} project={studyProjects.find((project) => project.id === selectedLibraryItem.projectId)} onBack={() => setView('library')} onSaveItem={onSaveLibraryItem} onDeleteItem={onDeleteLibraryItem} />;
  }

  return <div className="study-page study-home-page"><section className="study-hero panel"><div><p className="eyebrow">{T.stage}</p><h2>{studyUi.pageTitle}</h2><p>{studyUi.subtitle}</p></div><div className="exercise-hero-stats"><span>{studyProjects.length} {studyUi.projectUnit}</span><span>{studySessions.length} {studyUi.recordUnit}</span><span>{formatDuration(studySessions.reduce((sum, session) => sum + session.durationMinutes, 0))}</span></div></section><section className="panel study-category-entry-panel"><h2>{studyUi.projects}</h2><StudyCategoryEntrances projects={studyProjects} sessions={studySessions} onOpenCategory={openCategory} /></section><section className="panel study-distribution-panel"><h2>{studyUi.distribution}</h2><StudyTimeDistribution sessions={studySessions} /></section><section className="panel study-calendar-panel compact-study-calendar"><h2>{studyUi.calendar}</h2><StudyMonthCalendar sessions={studySessions} projects={studyProjects} chapters={studyChapters} onOpenProject={openProject} /></section><section className="panel study-library-entry-panel"><StudyLibraryHomeCards projects={studyProjects} items={studyLibraryItems} onOpenLibrary={openLibrary} /></section></div>;
}

function StudyCategoryEntrances({ projects, sessions, onOpenCategory }: { projects: Project[]; sessions: Session[]; onOpenCategory: (category: StudySubCategory) => void }) {
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  return <div className="exercise-category-entrances study-category-entrances">{studySubCategoryOptions.map((category) => { const categoryProjects = projects.filter((project) => project.subCategory === category); const categorySessions = sessions.filter((session) => session.subCategory === category); const minutes = categorySessions.reduce((sum, session) => sum + session.durationMinutes, 0); const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; const recent = categoryProjects[0]; return <button key={category} className={'exercise-category-entry study-category-entry ' + category} onClick={() => onOpenCategory(category)}><div><strong>{studySubCategoryLabels[category]}</strong><span>{categoryProjects.length} {'\u4e2a\u9879\u76ee'}</span></div><p>{recent ? '\u6700\u8fd1\uff1a' + recent.name : studyUi.noProject}</p><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><footer><span>{formatDuration(minutes)}</span><em>{percent}%</em></footer></button>; })}</div>;
}

function StudyCategoryBoard({ category, projects, sessions, activeTimer, onBack, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onOpenProject }: {
  category: StudySubCategory;
  projects: Project[];
  sessions: Session[];
  activeTimer: ActiveTimer | null;
  onBack: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onOpenProject: (projectId: string) => void;
}) {
  return <div className="notion-page study-category-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{studyUi.pageTitle} / {studySubCategoryLabels[category]}</div><h2>{studySubCategoryLabels[category]}</h2><p>{'\u8fd9\u91cc\u653e\u5f53\u524d\u5b66\u4e60\u7c7b\u578b\u4e0b\u7684\u9879\u76ee\uff0c\u70b9\u51fb\u9879\u76ee\u8fdb\u5165\u8be6\u60c5\u9875\u3002'}</p></section><section className="panel exercise-projects-panel category-projects-panel"><StudyProjectLibrary projects={projects} sessions={sessions} activeTimer={activeTimer} onOpenProject={onOpenProject} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} category={category} /></section></div>;
}

function StudyProjectLibrary({ projects, sessions, activeTimer, onOpenProject, onCreateProject, onDeleteProject, onStartTimer, onManualSession, category }: {
  projects: Project[];
  sessions: Session[];
  activeTimer: ActiveTimer | null;
  onOpenProject: (id: string) => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  category: StudySubCategory;
}) {
  const [name, setName] = useState('');
  const create = async () => { if (!name.trim()) return; const project = await onCreateProject({ name: name.trim(), mainCategory: 'study', subCategory: category, status: 'active' }); setName(''); onOpenProject(project.id); };
  return <div className="exercise-project-section study-project-section"><div className="inline-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={studyUi.newProjectPlaceholder} /><button className="secondary-button compact" onClick={create}>{studyUi.create}</button></div>{projects.length === 0 ? <p className="empty-text">{studyUi.noProject}</p> : <div className="exercise-project-list">{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const total = projectSessions.reduce((sum, session) => sum + session.durationMinutes, 0); return <article key={project.id} className="exercise-project-card study-project-card" onClick={() => onOpenProject(project.id)}><strong>{project.name}</strong><span>{projectSessions.length} {studyUi.times} / {formatDuration(total)}</span><div className="exercise-card-actions"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={(event) => { event.stopPropagation(); void onStartTimer(project); }}>{T.startTimer}</button><button className="secondary-button compact" onClick={(event) => { event.stopPropagation(); onManualSession({ mainCategory: 'study', subCategory: category, projectId: project.id }); }}>{T.manualSession}</button><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteProject(project); }}>{commonUi.delete}</button></div></article>; })}</div>}</div>;
}

function StudyProjectPage({ project, sessions, chapters, activeTimer, onBack, onDeleteProject, onStartTimer, onManualSession, onSaveChapter, onDeleteChapter }: { project: Project; sessions: Session[]; chapters: StudyChapter[]; activeTimer: ActiveTimer | null; onBack: () => void; onDeleteProject: (project: Project) => Promise<void>; onStartTimer: (project: Project) => Promise<void>; onManualSession: (preset: ManualPreset) => void; onSaveChapter: (chapter: StudyChapter) => Promise<void>; onDeleteChapter: (chapter: StudyChapter) => Promise<void> }) {
  const orderedSessions = [...sessions].sort((a, b) => b.startTime.localeCompare(a.startTime));
  const total = orderedSessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const average = orderedSessions.length > 0 ? Math.round(total / orderedSessions.length) : 0;
  const [notifiedChapterIds, setNotifiedChapterIds] = useState<string[]>([]);
  useEffect(() => {
    const id = window.setInterval(() => {
      const dueChapters = chapters.filter((chapter) => chapter.reviewReminderAt && !chapter.reviewReminderDone && new Date(chapter.reviewReminderAt).getTime() <= Date.now());
      dueChapters.forEach((chapter) => {
        if (notifiedChapterIds.includes(chapter.id)) return;
        const body = project.name + ' / ' + chapter.title + (chapter.reviewReminderNote ? ' / ' + chapter.reviewReminderNote : '');
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(studyUi.reviewReminder, { body });
        setNotifiedChapterIds((current) => current.includes(chapter.id) ? current : [...current, chapter.id]);
      });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [chapters, notifiedChapterIds, project.name]);
  return <div className="notion-page study-project-page"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{studyUi.pageTitle} / {studySubCategoryLabels[project.subCategory as StudySubCategory]} / {project.name}</div><h2>{project.name}</h2></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: 'study', subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button></section><section className="panel"><div className="exercise-detail-stats"><div><span>{studyUi.count}</span><strong>{orderedSessions.length} {studyUi.times}</strong></div><div><span>{studyUi.totalTime}</span><strong>{formatDuration(total)}</strong></div><div><span>{studyUi.averageTime}</span><strong>{formatDuration(average)}</strong></div><div><span>{studyUi.latestRecord}</span><strong>{orderedSessions[0] ? formatDateTime(orderedSessions[0].startTime) : studyUi.empty}</strong></div></div></section><section className="panel"><StudyChapterTable project={project} chapters={chapters} onSaveChapter={onSaveChapter} onDeleteChapter={onDeleteChapter} /></section><section className="panel"><h3>{T.recentRecords}</h3>{orderedSessions.length === 0 ? <p className="empty-text">{T.noRecords}</p> : <div className="exercise-session-list">{orderedSessions.map((session) => <StudySessionCard key={session.id} session={session} chapters={chapters} />)}</div>}</section></div>;
}

function StudyChapterTable({ project, chapters, onSaveChapter, onDeleteChapter }: { project: Project; chapters: StudyChapter[]; onSaveChapter: (chapter: StudyChapter) => Promise<void>; onDeleteChapter: (chapter: StudyChapter) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [reminderOpen, setReminderOpen] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [reminderAt, setReminderAt] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [message, setMessage] = useState('');
  const ordered = [...chapters].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const selectedChapter = ordered.find((chapter) => chapter.id === selectedChapterId) ?? ordered[0];

  useEffect(() => {
    if (!selectedChapterId && ordered[0]) setSelectedChapterId(ordered[0].id);
    if (selectedChapterId && !ordered.some((chapter) => chapter.id === selectedChapterId)) setSelectedChapterId(ordered[0]?.id ?? '');
  }, [ordered, selectedChapterId]);

  useEffect(() => {
    if (!selectedChapter) {
      setReminderAt('');
      setReminderNote('');
      return;
    }
    setReminderAt(selectedChapter.reviewReminderAt ? toInputDateTime(selectedChapter.reviewReminderAt) : '');
    setReminderNote(selectedChapter.reviewReminderNote ?? '');
    setMessage('');
  }, [selectedChapter?.id, selectedChapter?.reviewReminderAt, selectedChapter?.reviewReminderNote]);

  const create = async () => {
    if (!title.trim()) return;
    const timestamp = nowIso();
    await onSaveChapter({ id: createId(), projectId: project.id, title: title.trim(), status: 'notStarted', createdAt: timestamp, updatedAt: timestamp });
    setTitle('');
  };

  const saveReminder = async () => {
    if (!selectedChapter) {
      setMessage('\u8bf7\u5148\u65b0\u589e\u4e00\u4e2a\u77e5\u8bc6\u7ae0\u8282\uff0c\u518d\u8bbe\u7f6e\u5b66\u4e60\u63d0\u9192\u3002');
      return;
    }
    if (!reminderAt) {
      setMessage('\u8bf7\u9009\u62e9\u63d0\u9192\u65f6\u95f4\u3002');
      return;
    }
    await onSaveChapter({ ...selectedChapter, reviewReminderAt: fromInputDateTime(reminderAt), reviewReminderNote: reminderNote.trim() || project.name + ' / ' + selectedChapter.title, reviewReminderDone: false });
    setMessage('\u5b66\u4e60\u63d0\u9192\u5df2\u4fdd\u5b58\u3002');
  };

  const clearReminder = async () => {
    if (!selectedChapter) return;
    await onSaveChapter({ ...selectedChapter, reviewReminderAt: undefined, reviewReminderNote: undefined, reviewReminderDone: undefined });
    setReminderAt('');
    setReminderNote('');
    setMessage('\u5b66\u4e60\u63d0\u9192\u5df2\u6e05\u9664\u3002');
  };

  return <div className="study-chapter-table"><div className="section-heading"><h3>{studyUi.hierarchy}</h3><button className="secondary-button compact" onClick={() => setReminderOpen((value) => !value)}>{reminderOpen ? '\u6536\u8d77\u5b66\u4e60\u63d0\u9192' : studyUi.enableStudyReminder}</button></div><div className="study-chapter-create-simple"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={studyUi.chapterPlaceholder} /><button className="secondary-button compact" onClick={create}>{studyUi.addChapter}</button></div>{reminderOpen ? <div className="study-reminder-setup-panel"><label><span>{'\u9009\u62e9\u7ae0\u8282'}</span><select value={selectedChapter?.id ?? ''} onChange={(event) => setSelectedChapterId(event.target.value)} disabled={ordered.length === 0}>{ordered.length === 0 ? <option value="">{'\u8bf7\u5148\u65b0\u589e\u7ae0\u8282'}</option> : ordered.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label><label><span>{studyUi.reminderTime}</span><input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)} disabled={!selectedChapter} /></label><label><span>{studyUi.reminderNote}</span><input value={reminderNote} onChange={(event) => setReminderNote(event.target.value)} placeholder={selectedChapter ? project.name + ' / ' + selectedChapter.title : studyUi.reminderPlaceholder} disabled={!selectedChapter} /></label><div className="study-reminder-buttons"><button className="primary-button compact" onClick={saveReminder}>{studyUi.saveReminder}</button>{selectedChapter?.reviewReminderAt ? <button className="ghost-button compact" onClick={clearReminder}>{studyUi.clearReminder}</button> : null}{selectedChapter?.reviewReminderAt && !selectedChapter.reviewReminderDone ? <button className="ghost-button compact" onClick={() => onSaveChapter({ ...selectedChapter, reviewReminderDone: true })}>{studyUi.markReviewed}</button> : null}</div>{message ? <p className="study-notification-message">{message}</p> : null}</div> : null}{ordered.length === 0 ? <p className="empty-text">{studyUi.noChapters}</p> : <div className="study-chapter-list">{ordered.map((chapter) => <StudyChapterRow key={chapter.id} chapter={chapter} onSaveChapter={onSaveChapter} onDeleteChapter={onDeleteChapter} />)}</div>}</div>;
}

function StudyChapterRow({ chapter, onSaveChapter, onDeleteChapter }: { chapter: StudyChapter; onSaveChapter: (chapter: StudyChapter) => Promise<void>; onDeleteChapter: (chapter: StudyChapter) => Promise<void> }) {
  const reminderSummary = chapter.reviewReminderAt ? formatDateTime(chapter.reviewReminderAt) + (chapter.reviewReminderNote ? ' / ' + chapter.reviewReminderNote : '') : '\u8fd8\u6ca1\u6709\u590d\u4e60\u63d0\u9192';
  return <div className="study-chapter-row"><div className="study-chapter-main"><div><strong>{chapter.title}</strong><span>{reminderSummary}</span></div><div className="study-chapter-actions"><button className={chapter.status === 'completed' ? 'status-pill active' : 'status-pill'} onClick={() => onSaveChapter({ ...chapter, status: chapter.status === 'completed' ? 'notStarted' : 'completed' })}>{chapter.status === 'completed' ? studyUi.completed : studyUi.notStarted}</button><button className="danger-button compact" onClick={() => void onDeleteChapter(chapter)}>{commonUi.delete}</button></div></div></div>;
}

function StudyChapterSelector({ chapters, selectedIds, onChange }: { chapters: StudyChapter[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  return <div className="chapter-selector"><span>{studyUi.relatedChapters}</span>{chapters.length === 0 ? <p className="empty-text">{studyUi.noChapters}</p> : <div className="chapter-checkbox-grid">{chapters.map((chapter) => <label key={chapter.id}><input type="checkbox" checked={selectedIds.includes(chapter.id)} onChange={() => toggle(chapter.id)} />{chapter.title}</label>)}</div>}</div>;
}

function StudySessionCard({ session, chapters }: { session: Session; chapters: StudyChapter[] }) {
  const sessionChapters = chapters.filter((chapter) => session.chapterIds?.includes(chapter.id));
  return <article className="exercise-session-card study-session-card"><div className="daily-session-card-head"><strong>{formatDateTime(session.startTime)} - {formatDateTime(session.endTime)}</strong><span>{formatDuration(session.durationMinutes)}</span></div>{sessionChapters.length > 0 ? <div className="daily-session-field"><b>{studyUi.relatedChapters}</b><span>{sessionChapters.map((chapter) => chapter.title).join('\u3001')}</span></div> : null}<div className="daily-session-field"><b>{studyUi.learnedContent}</b><span>{session.content || studyUi.empty}</span></div><div className="daily-session-field"><b>{studyUi.feeling}</b><span>{session.feelings || studyUi.empty}</span></div>{session.attachments?.length ? <div className="daily-session-images">{session.attachments.map((image) => <img key={image.id} src={image.data} alt={studyUi.learnedContent} />)}</div> : null}</article>;
}

function StudyTimeDistribution({ sessions }: { sessions: Session[] }) {
  const totals = studySubCategoryOptions.reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as Record<StudySubCategory, number>);
  sessions.forEach((session) => { const key = session.subCategory as StudySubCategory; if (key in totals) totals[key] += session.durationMinutes; });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const colors: Record<StudySubCategory, string> = { computer: '#c94c4c', math: '#3977c9', english: '#3b9b60', other: '#d6a32f' };
  let cursor = 0;
  const pieSegments = studySubCategoryOptions.map((category) => {
    const value = totals[category];
    if (value <= 0 || total <= 0) return '';
    const start = cursor;
    const end = cursor + (value / total) * 100;
    cursor = end;
    return colors[category] + ' ' + start + '% ' + end + '%';
  }).filter(Boolean).join(', ');
  return <div className="study-distribution"><div className="study-progress-list">{studySubCategoryOptions.map((category) => { const minutes = totals[category]; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; return <div className="study-progress-row" key={category}><span>{studySubCategoryLabels[category]}</span><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><strong>{formatDuration(minutes)} / {percent}%</strong></div>; })}</div><div className="study-pie-summary"><div className="study-pie-chart" style={{ background: total > 0 ? 'conic-gradient(' + pieSegments + ')' : '#e8efeb' }}><span>{total > 0 ? formatDuration(total) : '0\u5206\u949f'}</span></div><div className="study-pie-legend">{studySubCategoryOptions.map((category) => <div key={category}><i style={{ background: colors[category] }} /><span>{studySubCategoryLabels[category]}</span><strong>{formatDuration(totals[category])}</strong></div>)}</div></div></div>;
}

function StudyMonthCalendar({ sessions, projects, chapters, onOpenProject }: { sessions: Session[]; projects: Project[]; chapters: StudyChapter[]; onOpenProject: (id: string) => void }) {
  const [monthCursor, setMonthCursor] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const cells = buildExerciseMonthCells(monthCursor);
  const selectedSessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === selectedDate);
  return <div className="exercise-calendar exercise-month-calendar study-month-calendar"><div className="calendar-toolbar"><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>{studyUi.previousMonth}</button><strong>{monthCursor.getFullYear()}{'\u5e74'}{monthCursor.getMonth() + 1}{'\u6708'}</strong><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>{studyUi.nextMonth}</button></div><div className="study-calendar-scroll"><div className="exercise-month-weekdays">{['\u5468\u4e00','\u5468\u4e8c','\u5468\u4e09','\u5468\u56db','\u5468\u4e94','\u5468\u516d','\u5468\u65e5'].map((day) => <span key={day}>{day}</span>)}</div><div className="exercise-month-grid">{cells.map((date, index) => { if (!date) return <span key={'empty-' + index} className="exercise-month-empty" />; const key = toDateKey(date); const daySessions = sessions.filter((session) => toDateKey(new Date(session.startTime)) === key); const marker = getStudyDayMarker(daySessions); return <button key={key} className={'exercise-month-day study-month-day ' + marker + (selectedDate === key ? ' selected' : '')} onClick={() => setSelectedDate(key)}><strong>{date.getDate()}</strong>{daySessions.length > 0 ? <span>{daySessions.length} {studyUi.times}</span> : <em>{studyUi.rest}</em>}</button>; })}</div></div><div className="selected-exercise-day selected-study-day"><h3>{selectedDate}</h3>{selectedSessions.length === 0 ? <p className="empty-text">{studyUi.dayEmpty}</p> : selectedSessions.map((session) => { const project = projects.find((item) => item.id === session.projectId); const sessionChapters = chapters.filter((chapter) => session.chapterIds?.includes(chapter.id)); return <article className="study-day-record" key={session.id}><div><strong>{studySubCategoryLabels[session.subCategory as StudySubCategory] ?? session.subCategory} / {session.projectNameSnapshot}</strong><span>{sessionChapters.length > 0 ? sessionChapters.map((chapter) => chapter.title).join('\u3001') : studyUi.noChapters}</span><em>{session.content || project?.name || studyUi.empty}</em></div><button className="secondary-button compact" onClick={() => onOpenProject(session.projectId)}>{'\u67e5\u770b\u9879\u76ee'}</button></article>; })}</div></div>;
}

function getStudyDayMarker(sessions: Session[]) {
  if (sessions.length === 0) return 'none';
  const types = new Set(sessions.map((session) => session.subCategory));
  if (types.size > 1) return 'study-mixed';
  return Array.from(types)[0] || 'none';
}

function StudyLibraryHomeCards({ projects, items, onOpenLibrary }: { projects: Project[]; items: StudyLibraryItem[]; onOpenLibrary: (type: StudyLibraryType) => void }) {
  const configs: { type: StudyLibraryType; title: string; desc: string }[] = [
    { type: 'mistake', title: studyUi.mistakes, desc: '\u6309\u5b66\u4e60\u9879\u76ee\u5f52\u6863\u9519\u9898\uff0c\u70b9\u8fdb\u53bb\u50cf Notion database \u4e00\u6837\u7ba1\u7406\u3002' },
    { type: 'note', title: studyUi.notes, desc: '\u4fdd\u5b58\u9879\u76ee\u7b14\u8bb0\u3001\u56fe\u7247\u548c\u590d\u76d8\uff0c\u70b9\u51fb\u6761\u76ee\u8fdb\u5165\u767d\u7eb8\u9875\u3002' },
  ];
  return <div className="study-library-home"><div className="section-heading"><h2>{studyUi.libraryDatabase}</h2></div><div className="study-library-entry-grid">{configs.map((config) => { const count = items.filter((item) => item.type === config.type).length; return <button key={config.type} className={'study-library-entry-card ' + config.type} onClick={() => onOpenLibrary(config.type)}><div><strong>{config.title}</strong><span>{count} {studyUi.recordUnit}</span></div><p>{config.desc}</p><footer><span>{projects.length} {studyUi.projectUnit}</span><em>{studyUi.openLibrary}</em></footer></button>; })}</div></div>;
}


function StudyLibraryDailyPlan({ type, plans, onSavePlan }: { type: StudyLibraryType; plans: StudyLibraryPlan[]; onSavePlan: (plan: StudyLibraryPlan) => Promise<void> }) {
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [content, setContent] = useState('');
  const [saveState, setSaveState] = useState('\u5df2\u6253\u5f00\u8ba1\u5212\u9875');
  const currentPlan = plans.find((plan) => plan.date === selectedDate);
  const label = type === 'mistake' ? studyUi.mistakes : studyUi.notes;

  useEffect(() => {
    setContent(currentPlan?.content ?? '');
    setSaveState(currentPlan ? '\u5df2\u8f7d\u5165' : '\u8fd9\u4e00\u5929\u8fd8\u662f\u7a7a\u767d');
  }, [currentPlan?.id, currentPlan?.content, selectedDate]);

  useEffect(() => {
    const existingContent = currentPlan?.content ?? '';
    if (content === existingContent) return;
    setSaveState('\u6b63\u5728\u81ea\u52a8\u4fdd\u5b58...');
    const timer = window.setTimeout(() => {
      const timestamp = nowIso();
      void onSavePlan({
        id: currentPlan?.id ?? createId(),
        type,
        date: selectedDate,
        content,
        createdAt: currentPlan?.createdAt ?? timestamp,
        updatedAt: timestamp
      }).then(() => setSaveState('\u5df2\u81ea\u52a8\u4fdd\u5b58'));
    }, 650);
    return () => window.clearTimeout(timer);
  }, [content, currentPlan?.content, currentPlan?.createdAt, currentPlan?.id, onSavePlan, selectedDate, type]);

  const moveDay = (days: number) => {
    const next = new Date(selectedDate + 'T00:00:00');
    next.setDate(next.getDate() + days);
    setSelectedDate(toDateKey(next));
  };

  return <section className="study-library-plan-paper"><div className="study-plan-paper-top"><div><span>{label} {'\u6bcf\u65e5\u8ba1\u5212'}</span><strong>{formatDate(selectedDate)}</strong></div><div className="study-plan-date-tools"><button className="ghost-button compact" onClick={() => moveDay(-1)}>{'\u4e0a\u4e00\u5929'}</button><button className="ghost-button compact" onClick={() => moveDay(1)}>{'\u4e0b\u4e00\u5929'}</button><label><span>{'\u9009\u62e9\u65e5\u671f'}</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || toDateKey(new Date()))} /></label></div></div><textarea className="study-plan-paper-textarea" value={content} onChange={(event) => setContent(event.target.value)} placeholder={'\u5728\u8fd9\u5f20\u767d\u7eb8\u4e0a\u5199\u4e0b' + label + '\u8fd9\u4e00\u5929\u7684\u8ba1\u5212\u3002\u53ef\u4ee5\u7528\u4e0a\u4e00\u5929\u3001\u4e0b\u4e00\u5929\u6216\u65e5\u671f\u9009\u62e9\u5668\u67e5\u770b\u548c\u63d0\u524d\u586b\u5199\u8ba1\u5212\u3002'} /><div className="study-plan-save-state">{saveState}</div></section>;
}

function StudyLibraryDatabasePage({ type, projects, items, plans, onBack, onOpenItem, onSaveItem, onDeleteItem, onSavePlan }: { type: StudyLibraryType; projects: Project[]; items: StudyLibraryItem[]; plans: StudyLibraryPlan[]; onBack: () => void; onOpenItem: (id: string) => void; onSaveItem: (item: StudyLibraryItem) => Promise<void>; onDeleteItem: (item: StudyLibraryItem) => Promise<void>; onSavePlan: (plan: StudyLibraryPlan) => Promise<void> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [recordedAt, setRecordedAt] = useState(toInputDateTime());
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); if (projectId && !projects.some((project) => project.id === projectId)) setProjectId(projects[0]?.id ?? ''); }, [projects, projectId]);
  const label = type === 'mistake' ? studyUi.mistakes : studyUi.notes;
  const create = async () => {
    if (!projectId || !title.trim()) return;
    const timestamp = nowIso();
    const item: StudyLibraryItem = { id: createId(), type, projectId, title: title.trim(), content: '', recordedAt: recordedAt ? fromInputDateTime(recordedAt) : timestamp, createdAt: timestamp, updatedAt: timestamp };
    await onSaveItem(item);
    setTitle('');
    onOpenItem(item.id);
  };
  const orderedItems = [...items].sort((a, b) => (b.recordedAt ?? b.createdAt).localeCompare(a.recordedAt ?? a.createdAt));
  return <div className="notion-page study-library-database-page"><StudyLibraryDailyPlan type={type} plans={plans} onSavePlan={onSavePlan} /><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{studyUi.pageTitle} / {label}</div><h2>{label}</h2><p>{'\u8fd9\u91cc\u662f\u72ec\u7acb\u8d44\u6599\u5e93\u3002\u5148\u65b0\u5efa\u6761\u76ee\uff0c\u518d\u70b9\u51fb\u8fdb\u5165\u767d\u7eb8\u9875\u7f16\u8f91\u5185\u5bb9\u548c\u56fe\u7247\u3002'}</p></section><section className="panel study-library-database-panel"><div className="study-library-toolbar"><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{studySubCategoryLabels[project.subCategory as StudySubCategory]} / {project.name}</option>)}</select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={studyUi.title} /><input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} /><button className="primary-button" onClick={create}>{studyUi.newItem}</button></div>{projects.length === 0 ? <p className="empty-text">{studyUi.noProject}</p> : orderedItems.length === 0 ? <p className="empty-text">{studyUi.noLibraryItem}</p> : <div className="study-library-table"><div className="study-library-table-head"><span>{studyUi.title}</span><span>{studyUi.relatedProject}</span><span>{studyUi.recordTime}</span><span>{studyUi.image}</span><span>{commonUi.action}</span></div>{orderedItems.map((item) => { const project = projects.find((candidate) => candidate.id === item.projectId); return <div key={item.id} className="study-library-table-row" role="button" tabIndex={0} onClick={() => onOpenItem(item.id)} onKeyDown={(event) => { if (event.key === 'Enter') onOpenItem(item.id); }}><strong>{item.title}</strong><span>{project ? studySubCategoryLabels[project.subCategory as StudySubCategory] + ' / ' + project.name : studyUi.empty}</span><span>{formatDateTime(item.recordedAt ?? item.createdAt)}</span><span>{item.imageData || item.imageUrl ? studyUi.image : studyUi.empty}</span><em><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteItem(item); }}>{commonUi.delete}</button></em></div>; })}</div>}</section></div>;
}

function StudyLibraryPaperPage({ item, project, onBack, onSaveItem, onDeleteItem }: { item: StudyLibraryItem; project?: Project; onBack: () => void; onSaveItem: (item: StudyLibraryItem) => Promise<void>; onDeleteItem: (item: StudyLibraryItem) => Promise<void> }) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [imageUrl, setImageUrl] = useState(item.imageUrl ?? '');
  const [imageData, setImageData] = useState(item.imageData ?? '');
  const [recordedAt, setRecordedAt] = useState(toInputDateTime(item.recordedAt ?? item.createdAt));
  useEffect(() => { setTitle(item.title); setContent(item.content); setImageUrl(item.imageUrl ?? ''); setImageData(item.imageData ?? ''); setRecordedAt(toInputDateTime(item.recordedAt ?? item.createdAt)); }, [item.id, item.title, item.content, item.imageUrl, item.imageData, item.recordedAt, item.createdAt]);
  const label = item.type === 'mistake' ? studyUi.mistakes : studyUi.notes;
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  const save = async () => {
    await onSaveItem({ ...item, title: title.trim() || item.title, content, imageUrl: imageUrl.trim() || undefined, imageData: imageData || undefined, recordedAt: recordedAt ? fromInputDateTime(recordedAt) : item.recordedAt, updatedAt: nowIso() });
  };
  return <div className="notion-page study-paper-page"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {studyUi.backToLibrary}</button><button className="danger-button compact" onClick={() => void onDeleteItem(item)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{studyUi.pageTitle} / {label} / {project ? project.name : studyUi.empty} / {item.title}</div><input className="study-paper-title-input" value={title} onChange={(event) => setTitle(event.target.value)} /></section><section className="study-paper-meta"><label><span>{studyUi.relatedProject}</span><input value={project ? studySubCategoryLabels[project.subCategory as StudySubCategory] + ' / ' + project.name : studyUi.empty} readOnly /></label><label><span>{studyUi.recordTime}</span><input type="datetime-local" value={recordedAt} onChange={(event) => setRecordedAt(event.target.value)} /></label><label><span>{studyUi.imageUrl}</span><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder={studyUi.imageUrl} /></label><label className="secondary-button compact file-like-button"><input type="file" accept="image/*" onChange={upload} />{studyUi.uploadImage}</label><button className="primary-button" onClick={save}>{studyUi.saveContent}</button></section><section className="study-paper-sheet"><p className="muted">{studyUi.paperHint}</p>{imageData || imageUrl ? <img className="study-paper-image" src={imageData || imageUrl} alt={title} /> : null}<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder={studyUi.content} /></section></div>;
}


function SelectExerciseSubCategory({ value, onChange }: { value: ExerciseSubCategory; onChange: (value: ExerciseSubCategory) => void }) {
  return <label><span>{exerciseUi.subCategory}</span><select value={value} onChange={(event) => onChange(event.target.value as ExerciseSubCategory)}>{exerciseSubCategoryOptions.map((category) => <option key={category} value={category}>{exerciseSubCategoryLabels[category]}</option>)}</select></label>;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day + 1);
  return result;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getExerciseDayMarker(sessions: Session[]) {
  if (sessions.length === 0) return 'none';
  const types = new Set(sessions.map((session) => session.subCategory));
  if (types.size > 1) return 'mixed';
  return Array.from(types)[0] || 'none';
}

function buildExerciseMonthCells(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index + 1))] as (Date | null)[];
}

function buildMonthCells(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const offset = first.getDay();
  const days = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => new Date(monthCursor.getFullYear(), monthCursor.getMonth(), index + 1))] as (Date | null)[];
}


const projectSubCategoryLabels: Record<ProjectSubCategory, string> = {
  gameDemo: '\u6e38\u620f Demo',
  development: '\u5f00\u53d1\u9879\u76ee',
  creation: '\u521b\u4f5c\u9879\u76ee',
};

const projectSubCategoryOptions: ProjectSubCategory[] = ['gameDemo', 'development', 'creation'];

const projectAssetTypeLabels: Record<ProjectLibraryAsset['assetType'], string> = {
  document: '\u6587\u6863',
  image: '\u56fe\u7247',
  code: '\u4ee3\u7801',
  link: '\u94fe\u63a5',
  other: '\u5176\u4ed6',
};

const projectAssetTypeOptions: ProjectLibraryAsset['assetType'][] = ['document', 'image', 'code', 'link', 'other'];

function ProjectSystemPage({ projects, sessions, journalEntries, reminders, tasks, assets, activeTimer, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onSaveJournalEntry, onSaveReminder, onDeleteReminder, onSaveTask, onDeleteTask, onSaveAsset, onDeleteAsset }: {
  projects: Project[];
  sessions: Session[];
  journalEntries: ProjectJournalEntry[];
  reminders: ProjectReminder[];
  tasks: ProjectTask[];
  assets: ProjectLibraryAsset[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
  onSaveReminder: (reminder: ProjectReminder) => Promise<void>;
  onDeleteReminder: (reminder: ProjectReminder) => Promise<void>;
  onSaveTask: (task: ProjectTask) => Promise<void>;
  onDeleteTask: (task: ProjectTask) => Promise<void>;
  onSaveAsset: (asset: ProjectLibraryAsset) => Promise<void>;
  onDeleteAsset: (asset: ProjectLibraryAsset) => Promise<void>;
}) {
  const projectProjects = projects.filter((project) => project.mainCategory === 'project');
  const projectSessions = sessions.filter((session) => session.mainCategory === 'project');
  const [view, setView] = useState<'home' | 'category' | 'project' | 'library' | 'plan'>('home');
  const [category, setCategory] = useState<ProjectSubCategory>('gameDemo');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const selectedProject = projectProjects.find((project) => project.id === selectedProjectId);
  const openCategory = (nextCategory: ProjectSubCategory) => { setCategory(nextCategory); setSelectedProjectId(''); setView('category'); };
  const openProject = (projectId: string) => {
    const project = projectProjects.find((item) => item.id === projectId);
    if (!project) return;
    setCategory(project.subCategory as ProjectSubCategory);
    setSelectedProjectId(project.id);
    setView('project');
  };
  const deleteAndLeaveProject = async (project: Project) => { await onDeleteProject(project); setSelectedProjectId(''); setView('category'); };

  useEffect(() => {
    if (selectedProjectId && !projectProjects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId('');
      if (view === 'project') setView('category');
    }
  }, [selectedProjectId, projectProjects, view]);

  if (view === 'category') {
    return <ProjectCategoryBoard category={category} projects={projectProjects.filter((project) => project.subCategory === category)} sessions={projectSessions} reminders={reminders} activeTimer={activeTimer} onBack={() => setView('home')} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onOpenProject={openProject} onSaveReminder={onSaveReminder} onDeleteReminder={onDeleteReminder} />;
  }
  if (view === 'project' && selectedProject) {
    return <ProjectWorkDetail project={selectedProject} sessions={projectSessions.filter((session) => session.projectId === selectedProject.id)} journalEntries={journalEntries.filter((entry) => entry.projectId === selectedProject.id)} reminders={reminders.filter((reminder) => reminder.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onDeleteProject={deleteAndLeaveProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onSaveJournalEntry={onSaveJournalEntry} onSaveReminder={onSaveReminder} onDeleteReminder={onDeleteReminder} />;
  }
  if (view === 'library') {
    return <ProjectLibraryPage projects={projectProjects} assets={assets} onBack={() => setView('home')} onSaveAsset={onSaveAsset} onDeleteAsset={onDeleteAsset} />;
  }
  if (view === 'plan') {
    return <ProjectPlanPage projects={projectProjects} tasks={tasks} onBack={() => setView('home')} onSaveTask={onSaveTask} onDeleteTask={onDeleteTask} onOpenProject={openProject} />;
  }

  return <ProjectHome projects={projectProjects} sessions={projectSessions} tasks={tasks} assets={assets} onOpenCategory={openCategory} onOpenLibrary={() => setView('library')} onOpenPlan={() => setView('plan')} onOpenProject={openProject} onSaveTask={onSaveTask} />;
}

function ProjectHome({ projects, sessions, tasks, assets, onOpenCategory, onOpenLibrary, onOpenPlan, onOpenProject, onSaveTask }: { projects: Project[]; sessions: Session[]; tasks: ProjectTask[]; assets: ProjectLibraryAsset[]; onOpenCategory: (category: ProjectSubCategory) => void; onOpenLibrary: () => void; onOpenPlan: () => void; onOpenProject: (id: string) => void; onSaveTask: (task: ProjectTask) => Promise<void> }) {
  const today = toDateKey(new Date());
  const todayTasks = tasks.filter((task) => task.date === today);
  const overdueTasks = tasks.filter((task) => task.date < today && task.status !== 'completed').sort((a, b) => a.date.localeCompare(b.date));
  return <div className="project-system-page"><section className="study-hero panel project-system-hero"><div><p className="eyebrow">{T.stage}</p><h2>{'\u9879\u76ee'}</h2><p>{'\u628a\u6e38\u620f Demo\u3001\u5f00\u53d1\u9879\u76ee\u548c\u521b\u4f5c\u9879\u76ee\u6536\u7eb3\u5230\u4e00\u4e2a\u63a8\u8fdb\u7cfb\u7edf\u91cc\uff0c\u8bb0\u5f55\u65f6\u95f4\u3001\u7b14\u8bb0\u3001\u8d44\u6599\u548c\u4efb\u52a1\u3002'}</p></div><div className="exercise-hero-stats"><span>{projects.length} {'\u4e2a\u9879\u76ee'}</span><span>{sessions.length} {'\u6761\u8bb0\u5f55'}</span><span>{assets.length} {'\u6761\u8d44\u6599'}</span></div></section><section className="panel project-category-panel"><h2>{'\u9879\u76ee\u5206\u7c7b'}</h2><ProjectCategoryEntrances projects={projects} sessions={sessions} onOpenCategory={onOpenCategory} /></section><section className="panel project-distribution-panel"><h2>{'\u9879\u76ee\u65f6\u95f4\u5206\u5e03'}</h2><ProjectTimeDistribution sessions={sessions} /></section><section className="panel project-library-entry-panel"><div className="project-entry-grid"><button className="study-library-entry-card" onClick={onOpenLibrary}><div><strong>{'\u9879\u76ee\u5e93'}</strong><span>{assets.length} {'\u6761\u8d44\u6599'}</span></div><p>{'\u6536\u7eb3\u6587\u6863\u3001\u4ee3\u7801\u3001\u94fe\u63a5\u7b49\u9879\u76ee\u8d44\u6599\u5360\u4f4d\u6761\u76ee\u3002'}</p><footer><span>{projects.length} {'\u4e2a\u5173\u8054\u9879\u76ee'}</span><em>{'\u6253\u5f00'}</em></footer></button><button className="study-library-entry-card" onClick={onOpenPlan}><div><strong>{'\u8ba1\u5212\u8868'}</strong><span>{tasks.length} {'\u4e2a\u4efb\u52a1'}</span></div><p>{'\u6309\u65e5\u671f\u7ba1\u7406\u4efb\u52a1\uff0c\u663e\u793a\u4eca\u5929\u8981\u505a\u548c\u8fc7\u53bb\u672a\u5b8c\u6210\u7684\u4e8b\u3002'}</p><footer><span>{todayTasks.length} {'\u4eca\u65e5\u4efb\u52a1'}</span><em>{'\u6253\u5f00'}</em></footer></button></div></section><section className="panel project-task-summary"><h2>{'\u4eca\u65e5\u4efb\u52a1'}</h2><ProjectTaskSummary tasks={todayTasks} projects={projects} onOpenProject={onOpenProject} onSaveTask={onSaveTask} empty={'\u4eca\u5929\u8fd8\u6ca1\u6709\u9879\u76ee\u4efb\u52a1'} /></section><section className="panel project-task-summary"><h2>{'\u8fc7\u53bb\u672a\u5b8c\u6210'}</h2><ProjectTaskSummary tasks={overdueTasks} projects={projects} onOpenProject={onOpenProject} onSaveTask={onSaveTask} empty={'\u6ca1\u6709\u8fc7\u53bb\u672a\u5b8c\u6210\u7684\u9879\u76ee\u4efb\u52a1'} /></section></div>;
}

function ProjectCategoryEntrances({ projects, sessions, onOpenCategory }: { projects: Project[]; sessions: Session[]; onOpenCategory: (category: ProjectSubCategory) => void }) {
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  return <div className="exercise-category-entrances project-category-entrances">{projectSubCategoryOptions.map((category) => { const categoryProjects = projects.filter((project) => project.subCategory === category); const categorySessions = sessions.filter((session) => session.subCategory === category); const minutes = categorySessions.reduce((sum, session) => sum + session.durationMinutes, 0); const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; const recent = categoryProjects[0]; return <button key={category} className={'exercise-category-entry project-category-entry ' + category} onClick={() => onOpenCategory(category)}><div><strong>{projectSubCategoryLabels[category]}</strong><span>{categoryProjects.length} {'\u4e2a\u9879\u76ee'}</span></div><p>{recent ? '\u6700\u8fd1\uff1a' + recent.name : '\u6682\u65e0\u9879\u76ee'}</p><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><footer><span>{formatDuration(minutes)}</span><em>{percent}%</em></footer></button>; })}</div>;
}

function ProjectTimeDistribution({ sessions }: { sessions: Session[] }) {
  const totals = projectSubCategoryOptions.reduce((acc, category) => ({ ...acc, [category]: 0 }), {} as Record<ProjectSubCategory, number>);
  sessions.forEach((session) => { const key = session.subCategory as ProjectSubCategory; if (key in totals) totals[key] += session.durationMinutes; });
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  return <div className="exercise-distribution project-time-distribution"><div className="exercise-progress-list">{projectSubCategoryOptions.map((category) => { const minutes = totals[category]; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; return <div className="exercise-progress-row" key={category}><span>{projectSubCategoryLabels[category]}</span><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><strong>{formatDuration(minutes)} / {percent}%</strong></div>; })}</div></div>;
}

function ProjectCategoryBoard({ category, projects, sessions, reminders, activeTimer, onBack, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onOpenProject, onSaveReminder, onDeleteReminder }: { category: ProjectSubCategory; projects: Project[]; sessions: Session[]; reminders: ProjectReminder[]; activeTimer: ActiveTimer | null; onBack: () => void; onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>; onDeleteProject: (project: Project) => Promise<void>; onStartTimer: (project: Project) => Promise<void>; onManualSession: (preset: ManualPreset) => void; onOpenProject: (projectId: string) => void; onSaveReminder: (reminder: ProjectReminder) => Promise<void>; onDeleteReminder: (reminder: ProjectReminder) => Promise<void> }) {
  const [name, setName] = useState('');
  const create = async () => { if (!name.trim()) return; const project = await onCreateProject({ name: name.trim(), mainCategory: 'project', subCategory: category, status: 'active' }); setName(''); onOpenProject(project.id); };
  return <div className="notion-page project-category-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{'\u9879\u76ee / ' + projectSubCategoryLabels[category]}</div><h2>{projectSubCategoryLabels[category]}</h2><p>{'\u8fd9\u91cc\u653e\u5f53\u524d\u9879\u76ee\u7c7b\u578b\u4e0b\u7684\u9879\u76ee\uff0c\u70b9\u51fb\u9879\u76ee\u8fdb\u5165\u8be6\u60c5\u9875\u3002'}</p></section><section className="panel project-category-list-panel"><div className="inline-create"><input value={name} onChange={(event) => setName(event.target.value)} placeholder={'\u4f8b\u5982\uff1a\u5e73\u53f0\u8df3\u8dc3'} /><button className="secondary-button compact" onClick={create}>{'\u521b\u5efa\u9879\u76ee'}</button></div>{projects.length === 0 ? <p className="empty-text">{'\u6682\u65e0\u9879\u76ee'}</p> : <div className="project-system-table">{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const projectReminders = reminders.filter((reminder) => reminder.projectId === project.id); const total = projectSessions.reduce((sum, session) => sum + session.durationMinutes, 0); const latest = projectSessions[0]; const nextReminder = projectReminders.filter((reminder) => reminder.status === 'active').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0]; return <article key={project.id} className="project-system-row" onClick={() => onOpenProject(project.id)}><div><strong>{project.name}</strong><span>{projectSubCategoryLabels[category]} / {formatDuration(total)} / {projectSessions.length} {'\u6761\u8bb0\u5f55'}</span><em>{latest ? '\u6700\u8fd1\uff1a' + formatDateTime(latest.startTime) : '\u6682\u65e0\u8bb0\u5f55'}</em><em>{nextReminder ? '\u4e0b\u6b21\u63d0\u9192\uff1a' + formatDateTime(nextReminder.scheduledAt) : '\u6682\u65e0\u63d0\u9192'}</em></div><ProjectReminderMini project={project} reminders={projectReminders} onSaveReminder={onSaveReminder} onDeleteReminder={onDeleteReminder} /><div className="exercise-card-actions"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={(event) => { event.stopPropagation(); void onStartTimer(project); }}>{T.startTimer}</button><button className="secondary-button compact" onClick={(event) => { event.stopPropagation(); onManualSession({ mainCategory: 'project', subCategory: category, projectId: project.id }); }}>{T.manualSession}</button><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteProject(project); }}>{commonUi.delete}</button></div></article>; })}</div>}</section></div>;
}

function ProjectReminderMini({ project, reminders, onSaveReminder, onDeleteReminder }: { project: Project; reminders: ProjectReminder[]; onSaveReminder: (reminder: ProjectReminder) => Promise<void>; onDeleteReminder: (reminder: ProjectReminder) => Promise<void> }) {
  const [scheduledAt, setScheduledAt] = useState('');
  const [title, setTitle] = useState('');
  const add = async () => { if (!scheduledAt) return; const timestamp = nowIso(); await onSaveReminder({ id: createId(), mainCategory: 'project', subCategory: project.subCategory, projectId: project.id, title: title.trim() || '\u63a8\u8fdb ' + project.name, scheduledAt: fromInputDateTime(scheduledAt), note: '', status: 'active', createdAt: timestamp, updatedAt: timestamp }); setScheduledAt(''); setTitle(''); };
  return <div className="project-reminder-mini" onClick={(event) => event.stopPropagation()}><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={'\u63d0\u9192\u5185\u5bb9'} /><button className="secondary-button compact" onClick={add}>{'\u4fdd\u5b58\u63d0\u9192'}</button>{reminders.slice(0, 2).map((reminder) => <span key={reminder.id} className="project-reminder-chip">{formatDateTime(reminder.scheduledAt)}<button onClick={() => void onDeleteReminder(reminder)}>{'\u5220\u9664'}</button></span>)}</div>;
}

function ProjectWorkDetail({ project, sessions, journalEntries, reminders, activeTimer, onBack, onDeleteProject, onStartTimer, onManualSession, onSaveJournalEntry, onSaveReminder, onDeleteReminder }: { project: Project; sessions: Session[]; journalEntries: ProjectJournalEntry[]; reminders: ProjectReminder[]; activeTimer: ActiveTimer | null; onBack: () => void; onDeleteProject: (project: Project) => Promise<void>; onStartTimer: (project: Project) => Promise<void>; onManualSession: (preset: ManualPreset) => void; onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>; onSaveReminder: (reminder: ProjectReminder) => Promise<void>; onDeleteReminder: (reminder: ProjectReminder) => Promise<void> }) {
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const latest = sessions[0];
  const nextReminder = reminders.filter((reminder) => reminder.status === 'active').sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  return <div className="notion-page project-work-detail"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{'\u9879\u76ee / ' + projectSubCategoryLabels[project.subCategory as ProjectSubCategory] + ' / ' + project.name}</div><h2>{project.name}</h2><div className="notion-properties"><div><span>{'\u5206\u7c7b'}</span><strong>{projectSubCategoryLabels[project.subCategory as ProjectSubCategory]}</strong></div><div><span>{'\u603b\u65f6\u957f'}</span><strong>{formatDuration(total)}</strong></div><div><span>{'\u8bb0\u5f55\u6b21\u6570'}</span><strong>{sessions.length}</strong></div><div><span>{'\u6700\u8fd1\u8bb0\u5f55'}</span><strong>{latest ? formatDateTime(latest.startTime) : '\u6682\u65e0\u8bb0\u5f55'}</strong></div><div><span>{'\u4e0b\u6b21\u63d0\u9192'}</span><strong>{nextReminder ? formatDateTime(nextReminder.scheduledAt) : '\u6682\u65e0\u63d0\u9192'}</strong></div></div></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: 'project', subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button><ProjectReminderMini project={project} reminders={reminders} onSaveReminder={onSaveReminder} onDeleteReminder={onDeleteReminder} /></section><section className="panel"><h3>{'\u9879\u76ee\u7b14\u8bb0'}</h3><ProjectNotebook project={project} sessions={sessions} journalEntries={journalEntries} onSaveJournalEntry={onSaveJournalEntry} /></section><section className="panel"><h3>{T.recentRecords}</h3>{sessions.length === 0 ? <p className="empty-text">{T.noRecords}</p> : <SessionList sessions={sessions.slice(0, 8)} />}</section></div>;
}

function ProjectLibraryPage({ projects, assets, onBack, onSaveAsset, onDeleteAsset }: { projects: Project[]; assets: ProjectLibraryAsset[]; onBack: () => void; onSaveAsset: (asset: ProjectLibraryAsset) => Promise<void>; onDeleteAsset: (asset: ProjectLibraryAsset) => Promise<void> }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<ProjectLibraryAsset['assetType']>('document');
  const [note, setNote] = useState('');
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); if (projectId && !projects.some((project) => project.id === projectId)) setProjectId(projects[0]?.id ?? ''); }, [projectId, projects]);
  const create = async () => { if (!projectId || !name.trim()) return; const timestamp = nowIso(); await onSaveAsset({ id: createId(), projectId, name: name.trim(), assetType, note: note.trim(), createdAt: timestamp, updatedAt: timestamp }); setName(''); setNote(''); };
  const ordered = [...assets].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="notion-page project-library-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{'\u9879\u76ee / \u9879\u76ee\u5e93'}</div><h2>{'\u9879\u76ee\u5e93'}</h2><p>{'\u8fd9\u91cc\u5148\u505a\u8d44\u6599\u6846\u67b6\uff0c\u7528\u6765\u5173\u8054\u9879\u76ee\u548c\u8bb0\u5f55\u6587\u4ef6\u7ebf\u7d22\u3002'}</p></section><section className="panel project-library-panel"><div className="study-library-toolbar"><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{projectSubCategoryLabels[project.subCategory as ProjectSubCategory]} / {project.name}</option>)}</select><input value={name} onChange={(event) => setName(event.target.value)} placeholder={'\u6587\u4ef6\u6216\u8d44\u6599\u540d'} /><select value={assetType} onChange={(event) => setAssetType(event.target.value as ProjectLibraryAsset['assetType'])}>{projectAssetTypeOptions.map((type) => <option key={type} value={type}>{projectAssetTypeLabels[type]}</option>)}</select><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={'\u5907\u6ce8'} /><button className="primary-button" onClick={create}>{'\u65b0\u589e\u8d44\u6599'}</button></div>{projects.length === 0 ? <p className="empty-text">{'\u8bf7\u5148\u521b\u5efa\u9879\u76ee'}</p> : ordered.length === 0 ? <p className="empty-text">{'\u6682\u65e0\u9879\u76ee\u5e93\u8d44\u6599'}</p> : <div className="study-library-table"><div className="study-library-table-head"><span>{'\u540d\u79f0'}</span><span>{'\u5173\u8054\u9879\u76ee'}</span><span>{'\u7c7b\u578b'}</span><span>{'\u5907\u6ce8'}</span><span>{commonUi.action}</span></div>{ordered.map((asset) => { const project = projects.find((item) => item.id === asset.projectId); return <div key={asset.id} className="study-library-table-row"><strong>{asset.name}</strong><span>{project ? projectSubCategoryLabels[project.subCategory as ProjectSubCategory] + ' / ' + project.name : '\u672a\u5173\u8054'}</span><span>{projectAssetTypeLabels[asset.assetType]}</span><span>{asset.note || '\u65e0\u5907\u6ce8'}</span><em><button className="danger-button compact" onClick={() => void onDeleteAsset(asset)}>{commonUi.delete}</button></em></div>; })}</div>}</section></div>;
}

function ProjectPlanPage({ projects, tasks, onBack, onSaveTask, onDeleteTask, onOpenProject }: { projects: Project[]; tasks: ProjectTask[]; onBack: () => void; onSaveTask: (task: ProjectTask) => Promise<void>; onDeleteTask: (task: ProjectTask) => Promise<void>; onOpenProject: (id: string) => void }) {
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '');
  const [title, setTitle] = useState('');
  useEffect(() => { if (!projectId && projects[0]) setProjectId(projects[0].id); if (projectId && !projects.some((project) => project.id === projectId)) setProjectId(projects[0]?.id ?? ''); }, [projectId, projects]);
  const isPast = selectedDate < toDateKey(new Date());
  const moveDay = (days: number) => { const next = new Date(selectedDate + 'T00:00:00'); next.setDate(next.getDate() + days); setSelectedDate(toDateKey(next)); };
  const create = async () => { if (!projectId || !title.trim() || isPast) return; const timestamp = nowIso(); await onSaveTask({ id: createId(), projectId, date: selectedDate, title: title.trim(), status: 'active', createdAt: timestamp, updatedAt: timestamp }); setTitle(''); };
  const dayTasks = tasks.filter((task) => task.date === selectedDate).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return <div className="notion-page project-plan-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{'\u9879\u76ee / \u8ba1\u5212\u8868'}</div><h2>{'\u8ba1\u5212\u8868'}</h2><p>{'\u6309\u65e5\u671f\u7ed9\u5177\u4f53\u9879\u76ee\u62c6\u4efb\u52a1\uff0c\u53ef\u4ee5\u63d0\u524d\u5199\u660e\u5929\u6216\u540e\u5929\u7684\u4efb\u52a1\u3002'}</p></section><section className="panel project-plan-panel"><div className="study-plan-date-tools project-plan-date-tools"><button className="ghost-button compact" onClick={() => moveDay(-1)}>{'\u4e0a\u4e00\u5929'}</button><strong>{formatDate(selectedDate)}</strong><button className="ghost-button compact" onClick={() => moveDay(1)}>{'\u4e0b\u4e00\u5929'}</button><label><span>{'\u9009\u62e9\u65e5\u671f'}</span><input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value || toDateKey(new Date()))} /></label></div>{!isPast ? <div className="study-library-toolbar"><select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{projectSubCategoryLabels[project.subCategory as ProjectSubCategory]} / {project.name}</option>)}</select><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={'\u4f8b\u5982\uff1a\u4e3b\u89d2\u79fb\u52a8\u529f\u80fd'} /><button className="primary-button" onClick={create}>{'\u65b0\u589e\u4efb\u52a1'}</button></div> : <p className="muted">{'\u8fc7\u53bb\u7684\u4efb\u52a1\u4e0d\u518d\u65b0\u589e\u6216\u4fee\u6539\uff0c\u4f46\u53ef\u4ee5\u8865\u52fe\u5b8c\u6210\u3002'}</p>}{dayTasks.length === 0 ? <p className="empty-text">{'\u8fd9\u4e00\u5929\u8fd8\u6ca1\u6709\u9879\u76ee\u4efb\u52a1'}</p> : <div className="project-task-list">{dayTasks.map((task) => <ProjectTaskRow key={task.id} task={task} projects={projects} onSaveTask={onSaveTask} onDeleteTask={onDeleteTask} onOpenProject={onOpenProject} />)}</div>}</section></div>;
}

function ProjectTaskSummary({ tasks, projects, onOpenProject, onSaveTask, empty }: { tasks: ProjectTask[]; projects: Project[]; onOpenProject: (id: string) => void; onSaveTask: (task: ProjectTask) => Promise<void>; empty: string }) {
  return tasks.length === 0 ? <p className="empty-text">{empty}</p> : <div className="project-task-list compact">{tasks.slice(0, 8).map((task) => <ProjectTaskRow key={task.id} task={task} projects={projects} onSaveTask={onSaveTask} onOpenProject={onOpenProject} />)}</div>;
}

function ProjectTaskRow({ task, projects, onSaveTask, onDeleteTask, onOpenProject }: { task: ProjectTask; projects: Project[]; onSaveTask: (task: ProjectTask) => Promise<void>; onDeleteTask?: (task: ProjectTask) => Promise<void>; onOpenProject: (id: string) => void }) {
  const project = projects.find((item) => item.id === task.projectId);
  const complete = async () => { await onSaveTask({ ...task, status: task.status === 'completed' ? 'active' : 'completed', completedAt: task.status === 'completed' ? undefined : nowIso() }); };
  return <article className={'project-task-row ' + task.status}><label><input type="checkbox" checked={task.status === 'completed'} onChange={complete} /><span>{task.title}</span></label><button className="ghost-button compact" onClick={() => onOpenProject(task.projectId)}>{project ? project.name : '\u67e5\u770b\u9879\u76ee'}</button><time>{task.date}</time>{onDeleteTask ? <button className="danger-button compact" onClick={() => void onDeleteTask(task)}>{commonUi.delete}</button> : null}</article>;
}

function BasicPage({ title, description, mainCategory, projects, onCreateProject, onDeleteProject, onStartTimer, onManualSession }: {
  title: string;
  description: string;
  mainCategory: MainCategory;
  projects: Project[];
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
}) {
  const [name, setName] = useState('');
  const categoryProjects = projects.filter((project) => project.mainCategory === mainCategory);
  const create = async () => { if (!name.trim()) return; await onCreateProject({ name, mainCategory, subCategory: 'general', status: 'active' }); setName(''); };
  return <div className="placeholder-grid"><section className="panel"><h2>{title}</h2><p className="muted">{description}</p><div className="inline-form"><label className="stacked-field"><span>{T.projectName}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={T.createBasicProject} /></label><button className="primary-button" onClick={create}>{T.createProject}</button></div></section><section className="panel span-2"><h2>{T.basicEntry}</h2>{categoryProjects.length === 0 ? <p className="empty-text">{T.noProject}</p> : <div className="project-list horizontal">{categoryProjects.map((project) => <div className="simple-project" key={project.id}><strong>{project.name}</strong><div className="detail-actions"><button className="primary-button compact" onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory, subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div></div>)}</div>}</section></div>;
}

function SessionList({ sessions }: { sessions: Session[] }) {
  return <div className="record-list">{sessions.map((session) => <div className="record-row" key={session.id}><div><strong>{getCategoryPath(session)}</strong><span>{formatDateTime(session.startTime)}</span>{session.content ? <span>{session.content}</span> : null}{session.feelings ? <span>{session.feelings}</span> : null}</div><b>{formatDuration(session.durationMinutes)}</b></div>)}</div>;
}

function CompactRows({ rows, empty }: { rows: string[][]; empty: string }) {
  return rows.length === 0 ? <p className="empty-text">{empty}</p> : <div className="compact-list">{rows.map(([label, value]) => <div className="compact-row" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

function SelectMainCategory({ value, onChange }: { value: MainCategory; onChange: (value: MainCategory) => void }) {
  return <label><span>{T.mainCategory}</span><select value={value} onChange={(event) => onChange(event.target.value as MainCategory)}>{mainCategoryOptions.map((category) => <option key={category} value={category}>{mainCategoryLabels[category]}</option>)}</select></label>;
}

function SelectSubCategory({ mainCategory, value, onChange }: { mainCategory: MainCategory; value: string; onChange: (value: string) => void }) {
  return <label><span>{T.subCategory}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{Object.entries(subCategoryLabels[mainCategory]).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>;
}

function SessionAttachmentPicker({ attachments, onChange }: { attachments: SessionAttachment[]; onChange: (attachments: SessionAttachment[]) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addFile = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      onChange([...attachments, { id: createId(), data: reader.result, createdAt: nowIso() }]);
    };
    reader.readAsDataURL(file);
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;
    event.preventDefault();
    files.forEach(addFile);
  };
  const remove = (id: string) => onChange(attachments.filter((item) => item.id !== id));

  return <div className="session-attachment-box" onPaste={handlePaste} tabIndex={0}><div className="attachment-box-header"><strong>{'\u672c\u6b21\u56fe\u7247'}</strong><button className="secondary-button compact" type="button" onClick={() => fileInputRef.current?.click()}>{'\u9009\u62e9\u56fe\u7247'}</button><input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={(event) => { Array.from(event.target.files ?? []).forEach(addFile); event.currentTarget.value = ''; }} /></div><p>{'\u53ef\u4ee5\u76f4\u63a5\u628a\u622a\u56fe\u6216\u56fe\u7247\u7c98\u8d34\u5230\u8fd9\u91cc\uff0c\u4e5f\u53ef\u4ee5\u9009\u62e9\u672c\u5730\u56fe\u7247\u3002'}</p>{attachments.length > 0 ? <div className="session-attachment-grid">{attachments.map((item) => <figure key={item.id}><img src={item.data} alt={'\u672c\u6b21\u56fe\u7247'} /><button type="button" onClick={() => remove(item.id)}>{'\u5220\u9664'}</button></figure>)}</div> : null}</div>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="stacked-field"><span>{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} /></label>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label><span>{label}</span><input type="number" min="1" max="5" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function DialogActions({ onCancel, actionLabel, onAction }: { onCancel: () => void; actionLabel: string; onAction: () => void | Promise<void> }) {
  return <div className="dialog-actions"><button className="secondary-button" onClick={onCancel}>{T.cancel}</button><button className="primary-button" onClick={() => void onAction()}>{actionLabel}</button></div>;
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation"><div className="dialog" role="dialog" aria-modal="true" aria-label={title}><div className="dialog-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label={T.close}>×</button></div>{children}</div></div>;
}

export default App;
