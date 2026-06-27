import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
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
  GrowthMetric,
  GrowthRecord,
  MainCategory,
  PlanTargetType,
  Project,
  ProjectImage,
  ProjectJournalEntry,
  ProjectStatus,
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
};

function sortByCreated<TItem extends { createdAt: string }>(items: TItem[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [pageHistory, setPageHistory] = useState<PageKey[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [exercisePlans, setExercisePlans] = useState<ExercisePlan[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetric[]>([]);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [journalEntries, setJournalEntries] = useState<ProjectJournalEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [quickStartCategory, setQuickStartCategory] = useState<MainCategory>('entertainment');
  const [manualPreset, setManualPreset] = useState<ManualPreset>({});
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [storedProjects, storedSessions, storedPlans, storedImages, storedJournalEntries, storedExercisePlans, storedGrowthMetrics, storedGrowthRecords, storedTimer] = await Promise.all([
      storage.getProjects(),
      storage.getSessions(),
      storage.getWeeklyPlans(),
      storage.getProjectImages(),
      storage.getProjectJournalEntries(),
      storage.getExercisePlans(),
      storage.getGrowthMetrics(),
      storage.getGrowthRecords(),
      storage.getActiveTimer(),
    ]);
    setProjects(sortByCreated(storedProjects));
    setSessions(sortByCreated(storedSessions));
    setWeeklyPlans(sortByCreated(storedPlans));
    setImages(storedImages);
    setJournalEntries(storedJournalEntries);
    setExercisePlans(sortByCreated(storedExercisePlans));
    setGrowthMetrics(sortByCreated(storedGrowthMetrics));
    setGrowthRecords(sortByCreated(storedGrowthRecords));
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
      ...exercisePlans.filter((plan) => plan.projectId === project.id).map((plan) => storage.deleteExercisePlan(plan.id)),
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

  const finishTimer = async (content: string, feelings: string, moodScore?: number, energyScore?: number, attachments: SessionAttachment[] = []) => {
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

  const saveExercisePlan = async (plan: ExercisePlan) => {
    await storage.saveExercisePlan({ ...plan, updatedAt: nowIso() });
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

  const deleteGrowthRecord = async (record: GrowthRecord) => {
    const confirmed = window.confirm('????????????');
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
            plans={weeklyPlans}
            activeTimer={activeTimer}
            onQuickStart={openQuickStart}
            onEndTimer={() => setDialog('endTimer')}
            onManualSession={() => openManual()}
            onSavePlan={savePlan}
          />
        ) : null}
        {!loading && page === 'entertainment' ? (
          <EntertainmentPage
            projects={projects}
            sessions={sessions}
            images={images}
            plans={weeklyPlans}
            activeTimer={activeTimer}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={deleteProject}
            onStartTimer={startTimer}
            onManualSession={openManual}
            journalEntries={journalEntries}
            onAddImage={addImage}
            onSaveJournalEntry={saveJournalEntry}
            onSavePlan={savePlan}
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
            onSaveGrowthMetric={saveGrowthMetric}
            onDeleteGrowthMetric={deleteGrowthMetric}
            onSaveGrowthRecord={saveGrowthRecord}
            onDeleteGrowthRecord={deleteGrowthRecord}
            onSaveSession={saveSession}
          />
        ) : null}
        {!loading && page === 'study' ? (
          <BasicPage title={T.study} description={T.studyPlaceholder} mainCategory="study" projects={projects} onCreateProject={createProject} onDeleteProject={deleteProject} onStartTimer={startTimer} onManualSession={openManual} />
        ) : null}
        {!loading && page === 'projects' ? (
          <BasicPage title={T.projects} description={T.projectPlaceholderPage} mainCategory="project" projects={projects} onCreateProject={createProject} onDeleteProject={deleteProject} onStartTimer={startTimer} onManualSession={openManual} />
        ) : null}
      </main>

      {dialog === 'quickStart' ? <QuickStartDialog initialCategory={quickStartCategory} projects={projects} onClose={() => setDialog(null)} onCreateProject={createProject} onStartTimer={startTimer} /> : null}
      {dialog === 'endTimer' && activeTimer ? <TimerEndDialog timer={activeTimer} onClose={() => setDialog(null)} onSave={finishTimer} /> : null}
      {dialog === 'manualSession' ? <ManualSessionDialog preset={manualPreset} projects={projects} onClose={() => setDialog(null)} onCreateProject={createProject} onSave={async (session) => { await saveSession(session); setDialog(null); }} /> : null}
    </div>
  );
}

function DashboardPage({ projects, sessions, plans, activeTimer, onQuickStart, onEndTimer, onManualSession, onSavePlan }: {
  projects: Project[];
  sessions: Session[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onQuickStart: (category: MainCategory) => void;
  onEndTimer: () => void;
  onManualSession: () => void;
  onSavePlan: (plan: WeeklyPlan) => Promise<void>;
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
      <section className="panel sketch-half-row"><WeeklyPlanPanel projects={projects} plans={plans} onSavePlan={onSavePlan} /></section>
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

function TimerEndDialog({ timer, onClose, onSave }: { timer: ActiveTimer; onClose: () => void; onSave: (content: string, feelings: string, moodScore?: number, energyScore?: number, attachments?: SessionAttachment[]) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [feelings, setFeelings] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [attachments, setAttachments] = useState<SessionAttachment[]>([]);
  const contentLabel = timer.mainCategory === 'exercise' ? '\u672c\u6b21\u5b8c\u6210\u76ee\u6807' : T.whatDone;
  return <Dialog title={T.endTimer} onClose={onClose}><div className="timer-summary"><strong>{timer.projectNameSnapshot}</strong><span>{mainCategoryLabels[timer.mainCategory]} / {getSubCategoryLabel(timer.mainCategory, timer.subCategory)}</span></div><TextArea label={contentLabel} value={content} onChange={setContent} /><TextArea label={T.feeling} value={feelings} onChange={setFeelings} /><SessionAttachmentPicker attachments={attachments} onChange={setAttachments} /><div className="form-grid"><NumberField label={T.moodScore} value={moodScore} onChange={setMoodScore} /><NumberField label={T.energyScore} value={energyScore} onChange={setEnergyScore} /></div><DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={() => onSave(content, feelings, moodScore, energyScore, attachments)} /></Dialog>;
}

function ManualSessionDialog({ preset, projects, onClose, onCreateProject, onSave }: {
  preset: ManualPreset;
  projects: Project[];
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
  const [error, setError] = useState('');
  const available = projects.filter((project) => project.mainCategory === mainCategory && project.subCategory === subCategory);
  const contentLabel = mainCategory === 'exercise' ? '\u672c\u6b21\u5b8c\u6210\u76ee\u6807' : T.whatDone;
  const changeCategory = (value: MainCategory) => { setMainCategory(value); setSubCategory(defaultSubCategory[value]); setProjectId(''); };
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
    await onSave({ id: createId(), mainCategory, subCategory, projectId: project.id, projectNameSnapshot: project.name, source: 'manual', startTime: startIso, endTime: endIso, durationMinutes: minutesBetween(startIso, endIso), content, feelings, attachments, createdAt: timestamp, updatedAt: timestamp });
  };
  return <Dialog title={T.manualSession} onClose={onClose}><div className="form-grid"><SelectMainCategory value={mainCategory} onChange={changeCategory} /><SelectSubCategory mainCategory={mainCategory} value={subCategory} onChange={setSubCategory} /><label><span>{T.startTime}</span><input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label><span>{T.endTime}</span><input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><label className="full-width"><span>{T.project}</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{T.selectProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="full-width"><span>{T.createProject}</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={T.projectPlaceholder} /></label></div><TextArea label={contentLabel} value={content} onChange={setContent} /><TextArea label={T.feeling} value={feelings} onChange={setFeelings} /><SessionAttachmentPicker attachments={attachments} onChange={setAttachments} />{error ? <p className="error-text">{error}</p> : null}<DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={submit} /></Dialog>;
}

function WeeklyPlanPanel({ projects, plans, onSavePlan }: { projects: Project[]; plans: WeeklyPlan[]; onSavePlan: (plan: WeeklyPlan) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const effectivePlans = plans.map((plan) => ({ ...plan, status: getEffectivePlanStatus(plan) }));
  return <div><div className="section-heading"><h2>{T.weeklyPlans}</h2><button className="primary-button compact" onClick={() => setCreating(!creating)}>{T.newPlan}</button></div>{creating ? <WeeklyPlanForm projects={projects} onCancel={() => setCreating(false)} onCreate={async (plan) => { await onSavePlan(plan); setCreating(false); }} /> : null}{effectivePlans.length === 0 ? <p className="empty-text">{T.noPlan}</p> : <div className="plan-list">{effectivePlans.map((plan) => <PlanRow key={plan.id} plan={plan} projects={projects} onSavePlan={onSavePlan} />)}</div>}</div>;
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

function PlanRow({ plan, projects, onSavePlan }: { plan: WeeklyPlan; projects: Project[]; onSavePlan: (plan: WeeklyPlan) => Promise<void> }) {
  const [progress, setProgress] = useState(String(plan.currentProgress));
  const project = projects.find((item) => item.id === plan.projectId);
  return <div className="plan-row"><div><div className="plan-title">{plan.title}</div><div className="meta-line">{plan.mainCategory ? mainCategoryLabels[plan.mainCategory] : T.noRelatedCategory}{project ? ' / ' + project.name : ''}{plan.deadline ? ' / ' + T.deadline + ' ' + formatDate(plan.deadline) : ''}</div></div><div className="plan-controls"><span className={'status-pill ' + plan.status}>{planStatusLabels[plan.status]}</span><input aria-label={T.currentProgress} type="number" min="0" value={progress} onChange={(event) => setProgress(event.target.value)} /><button className="secondary-button compact" onClick={() => onSavePlan({ ...plan, currentProgress: Number(progress || 0) })}>{T.updateProgress}</button><button className="secondary-button compact" onClick={() => onSavePlan({ ...plan, status: 'completed' })}>{T.markCompleted}</button><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'skipped' })}>{T.skip}</button></div></div>;
}

function EntertainmentPage({ projects, sessions, images, journalEntries, plans, activeTimer, onCreateProject, onUpdateProject, onDeleteProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSavePlan }: {
  projects: Project[];
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onUpdateProject: (project: Project) => Promise<void>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onAddImage: (project: Project, data: string, caption?: string) => Promise<void>;
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
  onSavePlan: (plan: WeeklyPlan) => Promise<void>;
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
    return <ProjectDetail project={selectedProject} sessions={sessions.filter((session) => session.projectId === selectedProject.id)} images={images.filter((image) => image.projectId === selectedProject.id)} journalEntries={journalEntries.filter((entry) => entry.projectId === selectedProject.id)} plans={plans.filter((plan) => plan.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onUpdateProject={onUpdateProject} onDeleteProject={deleteAndLeaveProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onAddImage={onAddImage} onSaveJournalEntry={onSaveJournalEntry} onSavePlan={onSavePlan} />;
  }
  if (view === 'category') {
    return <EntertainmentCategoryBoard category={category} projects={entertainmentProjects.filter((project) => project.subCategory === category)} sessions={sessions} plans={plans} onBack={() => setView('home')} onCreateProject={onCreateProject} onDeleteProject={onDeleteProject} onOpenProject={enterProject} />;
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

function EntertainmentCategoryBoard({ category, projects, sessions, plans, onBack, onCreateProject, onDeleteProject, onOpenProject }: {
  category: string;
  projects: Project[];
  sessions: Session[];
  plans: WeeklyPlan[];
  onBack: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onDeleteProject: (project: Project) => Promise<void>;
  onOpenProject: (projectId: string) => void;
}) {
  return <div className="notion-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><div className="notion-breadcrumb">{T.entertainment} / {getSubCategoryLabel('entertainment', category)}</div><h2>{getSubCategoryLabel('entertainment', category)}</h2><p>{'\u50cf Notion database \u4e00\u6837\u7ba1\u7406\u8fd9\u4e2a\u5206\u7c7b\u4e0b\u7684\u9879\u76ee\u3002\u70b9\u51fb\u4efb\u610f\u4e00\u884c\u8fdb\u5165\u9879\u76ee\u7b14\u8bb0\u9875\u3002'}</p></section><EntertainmentProjectForm subCategory={category} onCreateProject={onCreateProject} /><section className="notion-section"><div className="notion-section-title"><h3>{'\u9879\u76ee\u8868\u683c'}</h3><span>{projects.length} {'\u4e2a\u9879\u76ee'}</span></div>{projects.length === 0 ? <p className="empty-text">{T.noProject}</p> : <div className="project-table-wrap notion-table-wrap"><table className="project-table notion-table"><thead><tr><th>{T.project}</th><th>{'\u72b6\u6001'}</th><th>{'\u603b\u65f6\u957f'}</th><th>{'\u6700\u8fd1\u8bb0\u5f55'}</th><th>{'\u8ba1\u5212/\u63d0\u9192'}</th><th>{'\u6700\u8fd1\u611f\u53d7'}</th><th>{commonUi.action}</th></tr></thead><tbody>{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const total = getProjectTotalMinutes(project.id, sessions); const latest = projectSessions[0]; const projectPlans = plans.filter((plan) => plan.projectId === project.id); const nextPlan = projectPlans.filter((plan) => getEffectivePlanStatus(plan) === 'active' && plan.deadline).sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())[0]; const planSummary = nextPlan ? formatDateTime(nextPlan.deadline || nextPlan.createdAt) + ' / ' + nextPlan.title : projectPlans.length > 0 ? projectPlans.length + ' ' + '\u4e2a\u8ba1\u5212\u8bb0\u5f55' : '\u6682\u65e0\u63d0\u9192'; return <tr key={project.id} onClick={() => onOpenProject(project.id)}><td><strong>{project.name}</strong><small>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</small></td><td><span className="notion-tag">{projectStatusLabels[project.status]}</span></td><td>{formatDuration(total)}</td><td>{latest ? formatDateTime(latest.startTime) + ' / ' + formatDuration(latest.durationMinutes) : '\u6682\u65e0\u8bb0\u5f55'}</td><td>{planSummary}</td><td>{latest?.feelings || '\u6682\u65e0\u611f\u53d7'}</td><td><button className="danger-button compact" onClick={(event) => { event.stopPropagation(); void onDeleteProject(project); }}>{commonUi.delete}</button></td></tr>; })}</tbody></table></div>}</section></div>;
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

function ProjectDetail({ project, sessions, images, journalEntries, plans, activeTimer, onBack, onUpdateProject, onDeleteProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSavePlan }: {
  project?: Project;
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onBack: () => void;
  onUpdateProject: (project: Project) => Promise<void>;
  onDeleteProject: (project: Project) => Promise<void>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
  onAddImage: (project: Project, data: string, caption?: string) => Promise<void>;
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
  onSavePlan: (plan: WeeklyPlan) => Promise<void>;
}) {
  const [reminderTime, setReminderTime] = useState('');
  const [reminderTitle, setReminderTitle] = useState('');
  if (!project) return <div className="detail-panel"><p className="empty-text">{T.chooseOrCreateDetail}</p></div>;
  const total = sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const latest = sessions[0];
  const nextPlan = plans.filter((plan) => getEffectivePlanStatus(plan) === 'active' && plan.deadline).sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())[0];
  const addReminder = async () => { if (!reminderTime) return; const timestamp = nowIso(); await onSavePlan({ id: createId(), title: reminderTitle.trim() || '\u8fdb\u884c ' + project.name, mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id, deadline: fromInputDateTime(reminderTime), targetType: 'completion', currentProgress: 0, status: 'active', createdAt: timestamp, updatedAt: timestamp }); setReminderTime(''); setReminderTitle(''); };
  return <div className="notion-page notion-project-page notebook-project-page"><section className="notion-doc-title"><div className="notion-title-actions"><button className="notion-back" onClick={onBack}>{'\u2190'} {commonUi.back}</button><button className="danger-button compact" onClick={() => void onDeleteProject(project)}>{commonUi.delete}</button></div><div className="notion-breadcrumb">{T.entertainment} / {getSubCategoryLabel(project.mainCategory, project.subCategory)} / {project.name}</div><h2>{project.name}</h2><div className="notion-properties"><div><span>{'\u72b6\u6001'}</span><select value={project.status} onChange={(event) => onUpdateProject({ ...project, status: event.target.value as ProjectStatus })}>{projectStatusOptions.map((option) => <option key={option} value={option}>{projectStatusLabels[option]}</option>)}</select></div><div><span>{'\u5206\u7c7b'}</span><strong>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</strong></div><div><span>{'\u603b\u65f6\u957f'}</span><strong>{formatDuration(total)}</strong></div><div><span>{'\u6700\u8fd1\u8bb0\u5f55'}</span><strong>{latest ? formatDateTime(latest.startTime) : '\u6682\u65e0\u8bb0\u5f55'}</strong></div><div><span>{'\u4e0b\u6b21\u63d0\u9192'}</span><strong>{nextPlan ? formatDateTime(nextPlan.deadline || nextPlan.createdAt) : '\u6682\u65e0\u63d0\u9192'}</strong></div></div></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button><label><span>{'\u63d0\u9192\u65f6\u95f4'}</span><input type="datetime-local" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label><label><span>{'\u63d0\u9192\u5185\u5bb9'}</span><input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder={'\u8fdb\u884c ' + project.name} /></label><button className="secondary-button compact" onClick={addReminder}>{'\u4fdd\u5b58\u63d0\u9192'}</button></section><ProjectNotebook project={project} sessions={sessions} journalEntries={journalEntries} onSaveJournalEntry={onSaveJournalEntry} /><section className="notion-block legacy-images"><details><summary>{'\u5386\u53f2\u56fe\u7247'}</summary>{images.length > 0 ? <div className="image-grid">{images.map((image) => <figure key={image.id}><img src={image.data} alt={image.caption || T.projectImages} />{image.caption ? <figcaption>{image.caption}</figcaption> : null}</figure>)}</div> : <p className="empty-text">{'\u6682\u65e0\u5386\u53f2\u56fe\u7247'}</p>}</details></section></div>;
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

function ExercisePage({ projects, sessions, exercisePlans, growthMetrics, growthRecords, activeTimer, onCreateProject, onDeleteProject, onStartTimer, onManualSession, onSaveExercisePlan, onSaveGrowthMetric, onDeleteGrowthMetric, onSaveGrowthRecord, onDeleteGrowthRecord, onSaveSession }: {
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
        <ExercisePlanPanel projects={exerciseProjects} plans={exercisePlans} onSavePlan={onSaveExercisePlan} />
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

function ExercisePlanPanel({ projects, plans, onSavePlan }: { projects: Project[]; plans: ExercisePlan[]; onSavePlan: (plan: ExercisePlan) => Promise<void> }) {
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

  return <div className="exercise-plan-panel"><div className="notification-row">{notificationEnabled ? <span className="status-pill active">{exerciseUi.notificationOn}</span> : <button className="secondary-button compact" onClick={requestNotification}>{exerciseUi.enableNotification}</button>}{duePlans.length > 0 ? <span className="warning-text">{exerciseUi.overduePrefix} {duePlans.length} {exerciseUi.overdueSuffix}</span> : null}</div><div className="exercise-plan-form"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={exerciseUi.planPlaceholder} /><SelectExerciseSubCategory value={subCategory} onChange={(value) => { setSubCategory(value); setProjectId(''); }} /><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{exerciseUi.relatedProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={exerciseUi.note} /><button className="primary-button" onClick={create}>{exerciseUi.addPlan}</button></div><div className="calendar-toolbar"><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}>{exerciseUi.previousMonth}</button><strong>{monthCursor.getFullYear()}{'\u5e74'}{monthCursor.getMonth() + 1}{'\u6708'}</strong><button className="secondary-button compact" onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}>{exerciseUi.nextMonth}</button></div><div className="exercise-plan-month">{buildMonthCells(monthCursor).map((date, index) => date ? <div key={toDateKey(date)} className="exercise-plan-day"><strong>{date.getDate()}</strong>{monthPlans.filter((plan) => toDateKey(new Date(plan.scheduledAt)) === toDateKey(date)).map((plan) => <div key={plan.id} className={'exercise-plan-item ' + plan.status}><span>{formatDateTime(plan.scheduledAt)} {plan.title}</span><small>{exerciseSubCategoryLabels[plan.subCategory]}</small>{plan.note ? <small>{plan.note}</small> : null}<div><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'done' })}>{exerciseUi.done}</button><button className="ghost-button compact" onClick={() => onSavePlan({ ...plan, status: 'skipped' })}>{exerciseUi.skipped}</button></div></div>)}</div> : <div key={'empty-' + index} className="exercise-plan-day empty" />)}</div></div>;
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
  return <div className="exercise-distribution">{exerciseSubCategoryOptions.map((category) => { const minutes = totals[category]; const percent = total > 0 ? Math.round((minutes / total) * 100) : 0; return <div className="exercise-progress-row" key={category}><span>{exerciseSubCategoryLabels[category]}</span><div className="exercise-progress"><div className={category} style={{ width: percent + '%' }} /></div><strong>{formatDuration(minutes)} / {percent}%</strong></div>; })}</div>;
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
