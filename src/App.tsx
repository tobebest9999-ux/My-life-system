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
  MainCategory,
  PlanTargetType,
  Project,
  ProjectImage,
  ProjectJournalEntry,
  ProjectStatus,
  Session,
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

function sortByCreated<TItem extends { createdAt: string }>(items: TItem[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function App() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlan[]>([]);
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [journalEntries, setJournalEntries] = useState<ProjectJournalEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [quickStartCategory, setQuickStartCategory] = useState<MainCategory>('entertainment');
  const [manualPreset, setManualPreset] = useState<ManualPreset>({});
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const [storedProjects, storedSessions, storedPlans, storedImages, storedJournalEntries, storedTimer] = await Promise.all([
      storage.getProjects(),
      storage.getSessions(),
      storage.getWeeklyPlans(),
      storage.getProjectImages(),
      storage.getProjectJournalEntries(),
      storage.getActiveTimer(),
    ]);
    setProjects(sortByCreated(storedProjects));
    setSessions(sortByCreated(storedSessions));
    setWeeklyPlans(sortByCreated(storedPlans));
    setImages(storedImages);
    setJournalEntries(storedJournalEntries);
    setActiveTimer(storedTimer);
    setLoading(false);
  };

  useEffect(() => {
    void reload();
  }, []);

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
    setPage('dashboard');
    await reload();
  };

  const saveSession = async (session: Session) => {
    await storage.saveSession(session);
    await reload();
  };

  const finishTimer = async (content: string, feelings: string, moodScore?: number, energyScore?: number) => {
    if (!activeTimer) return;
    const endTime = nowIso();
    const timestamp = nowIso();
    await storage.saveSession({
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
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await storage.clearActiveTimer();
    setDialog(null);
    await reload();
  };

  const savePlan = async (plan: WeeklyPlan) => {
    await storage.saveWeeklyPlan({ ...plan, updatedAt: nowIso() });
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
            <button key={item.key} className={page === item.key ? 'nav-button active' : 'nav-button'} onClick={() => setPage(item.key)}>
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
          <button className="secondary-button" onClick={() => openManual()}>{T.manualSession}</button>
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
            onStartTimer={startTimer}
            onManualSession={openManual}
            journalEntries={journalEntries}
            onAddImage={addImage}
            onSaveJournalEntry={saveJournalEntry}
            onSavePlan={savePlan}
          />
        ) : null}
        {!loading && page === 'exercise' ? (
          <BasicPage title={T.exercise} description={T.exercisePlaceholder} mainCategory="exercise" projects={projects} onCreateProject={createProject} onStartTimer={startTimer} onManualSession={openManual} />
        ) : null}
        {!loading && page === 'study' ? (
          <BasicPage title={T.study} description={T.studyPlaceholder} mainCategory="study" projects={projects} onCreateProject={createProject} onStartTimer={startTimer} onManualSession={openManual} />
        ) : null}
        {!loading && page === 'projects' ? (
          <BasicPage title={T.projects} description={T.projectPlaceholderPage} mainCategory="project" projects={projects} onCreateProject={createProject} onStartTimer={startTimer} onManualSession={openManual} />
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
    <div className="dashboard-fill-layout">
      <div className="dashboard-main-stack">
        <section className="panel">
          <div className="section-heading"><h2>{T.quickStart}</h2><button className="ghost-button" onClick={onManualSession}>{T.manualSession}</button></div>
          <div className="quick-grid">
            {mainCategoryOptions.map((category) => <button key={category} className="quick-button" onClick={() => onQuickStart(category)}>{'\u5f00\u59cb' + mainCategoryLabels[category]}</button>)}
          </div>
        </section>
        <section className="panel">
          <h2>{T.timeDistribution}</h2>
          <PieTimeDistribution totals={totals} />
        </section>
        <section className="panel"><WeeklyPlanPanel projects={projects} plans={plans} onSavePlan={onSavePlan} /></section>
      </div>
      <div className="dashboard-side-stack">
        <section className="panel dashboard-calendar-corner"><DashboardCalendar sessions={sessions} plans={plans} /></section>
        <section className="panel">
          <h2>{T.activeTimer}</h2>
          {activeTimer ? <ActiveTimerCard timer={activeTimer} onEndTimer={onEndTimer} /> : <p className="empty-text">{T.noActiveTimer}</p>}
        </section>
        <section className="panel">
          <h2>{T.recentRecords}</h2>
          {sessions.length === 0 ? <p className="empty-text">{T.noRecords}</p> : <SessionList sessions={sessions.slice(0, 6)} />}
        </section>
        <section className="panel"><h2>{T.suggestions}</h2><div className="suggestion-list">{suggestions.map((item) => <div className={'suggestion ' + item.severity} key={item.id}>{item.message}</div>)}</div></section>
      </div>
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

function TimerEndDialog({ timer, onClose, onSave }: { timer: ActiveTimer; onClose: () => void; onSave: (content: string, feelings: string, moodScore?: number, energyScore?: number) => Promise<void> }) {
  const [content, setContent] = useState('');
  const [feelings, setFeelings] = useState('');
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  return <Dialog title={T.endTimer} onClose={onClose}><div className="timer-summary"><strong>{timer.projectNameSnapshot}</strong><span>{mainCategoryLabels[timer.mainCategory]} / {getSubCategoryLabel(timer.mainCategory, timer.subCategory)}</span></div><TextArea label={T.whatDone} value={content} onChange={setContent} /><TextArea label={T.feeling} value={feelings} onChange={setFeelings} /><div className="form-grid"><NumberField label={T.moodScore} value={moodScore} onChange={setMoodScore} /><NumberField label={T.energyScore} value={energyScore} onChange={setEnergyScore} /></div><DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={() => onSave(content, feelings, moodScore, energyScore)} /></Dialog>;
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
  const [error, setError] = useState('');
  const available = projects.filter((project) => project.mainCategory === mainCategory && project.subCategory === subCategory);
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
    await onSave({ id: createId(), mainCategory, subCategory, projectId: project.id, projectNameSnapshot: project.name, source: 'manual', startTime: startIso, endTime: endIso, durationMinutes: minutesBetween(startIso, endIso), content, feelings, createdAt: timestamp, updatedAt: timestamp });
  };
  return <Dialog title={T.manualSession} onClose={onClose}><div className="form-grid"><SelectMainCategory value={mainCategory} onChange={changeCategory} /><SelectSubCategory mainCategory={mainCategory} value={subCategory} onChange={setSubCategory} /><label><span>{T.startTime}</span><input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label><label><span>{T.endTime}</span><input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label><label className="full-width"><span>{T.project}</span><select value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">{T.selectProject}</option>{available.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="full-width"><span>{T.createProject}</span><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={T.projectPlaceholder} /></label></div><TextArea label={T.whatDone} value={content} onChange={setContent} /><TextArea label={T.feeling} value={feelings} onChange={setFeelings} />{error ? <p className="error-text">{error}</p> : null}<DialogActions onCancel={onClose} actionLabel={T.saveRecord} onAction={submit} /></Dialog>;
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

function EntertainmentPage({ projects, sessions, images, journalEntries, plans, activeTimer, onCreateProject, onUpdateProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSavePlan }: {
  projects: Project[];
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onUpdateProject: (project: Project) => Promise<void>;
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
  if (view === 'project' && selectedProject) {
    return <ProjectDetail project={selectedProject} sessions={sessions.filter((session) => session.projectId === selectedProject.id)} images={images.filter((image) => image.projectId === selectedProject.id)} journalEntries={journalEntries.filter((entry) => entry.projectId === selectedProject.id)} plans={plans.filter((plan) => plan.projectId === selectedProject.id)} activeTimer={activeTimer} onBack={() => setView('category')} onUpdateProject={onUpdateProject} onStartTimer={onStartTimer} onManualSession={onManualSession} onAddImage={onAddImage} onSaveJournalEntry={onSaveJournalEntry} onSavePlan={onSavePlan} />;
  }
  if (view === 'category') {
    return <EntertainmentCategoryBoard category={category} projects={entertainmentProjects.filter((project) => project.subCategory === category)} sessions={sessions} plans={plans} onBack={() => setView('home')} onCreateProject={onCreateProject} onOpenProject={enterProject} />;
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

function EntertainmentCategoryBoard({ category, projects, sessions, plans, onBack, onCreateProject, onOpenProject }: {
  category: string;
  projects: Project[];
  sessions: Session[];
  plans: WeeklyPlan[];
  onBack: () => void;
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onOpenProject: (projectId: string) => void;
}) {
  return <div className="notion-page"><section className="notion-database-header"><button className="notion-back" onClick={onBack}>← 娱乐</button><div className="notion-breadcrumb">娱乐 / {getSubCategoryLabel('entertainment', category)}</div><h2>{getSubCategoryLabel('entertainment', category)}</h2><p>像 Notion database 一样管理这个分类下的项目。点击任意一行进入项目笔记页。</p></section><EntertainmentProjectForm subCategory={category} onCreateProject={onCreateProject} /><section className="notion-section"><div className="notion-section-title"><h3>项目表格</h3><span>{projects.length} 个项目</span></div>{projects.length === 0 ? <p className="empty-text">{T.noProject}</p> : <div className="project-table-wrap notion-table-wrap"><table className="project-table notion-table"><thead><tr><th>项目</th><th>状态</th><th>总时长</th><th>最近记录</th><th>计划/提醒</th><th>最近感受</th></tr></thead><tbody>{projects.map((project) => { const projectSessions = sessions.filter((session) => session.projectId === project.id); const total = getProjectTotalMinutes(project.id, sessions); const latest = projectSessions[0]; const projectPlans = plans.filter((plan) => plan.projectId === project.id); const nextPlan = projectPlans.filter((plan) => getEffectivePlanStatus(plan) === 'active' && plan.deadline).sort((a, b) => new Date(a.deadline || '').getTime() - new Date(b.deadline || '').getTime())[0]; const planSummary = nextPlan ? formatDateTime(nextPlan.deadline || nextPlan.createdAt) + ' / ' + nextPlan.title : projectPlans.length > 0 ? projectPlans.length + ' 个计划记录' : '暂无提醒'; return <tr key={project.id} onClick={() => onOpenProject(project.id)}><td><strong>{project.name}</strong><small>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</small></td><td><span className="notion-tag">{projectStatusLabels[project.status]}</span></td><td>{formatDuration(total)}</td><td>{latest ? formatDateTime(latest.startTime) + ' / ' + formatDuration(latest.durationMinutes) : '暂无记录'}</td><td>{planSummary}</td><td>{latest?.feelings || '暂无感受'}</td></tr>; })}</tbody></table></div>}</section></div>;
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

function ProjectDetail({ project, sessions, images, journalEntries, plans, activeTimer, onBack, onUpdateProject, onStartTimer, onManualSession, onAddImage, onSaveJournalEntry, onSavePlan }: {
  project?: Project;
  sessions: Session[];
  images: ProjectImage[];
  journalEntries: ProjectJournalEntry[];
  plans: WeeklyPlan[];
  activeTimer: ActiveTimer | null;
  onBack: () => void;
  onUpdateProject: (project: Project) => Promise<void>;
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
  const addReminder = async () => { if (!reminderTime) return; const timestamp = nowIso(); await onSavePlan({ id: createId(), title: reminderTitle.trim() || '进行 ' + project.name, mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id, deadline: fromInputDateTime(reminderTime), targetType: 'completion', currentProgress: 0, status: 'active', createdAt: timestamp, updatedAt: timestamp }); setReminderTime(''); setReminderTitle(''); };
  return <div className="notion-page notion-project-page notebook-project-page"><section className="notion-doc-title"><button className="notion-back" onClick={onBack}>← 返回列表</button><div className="notion-breadcrumb">娱乐 / {getSubCategoryLabel(project.mainCategory, project.subCategory)} / {project.name}</div><h2>{project.name}</h2><div className="notion-properties"><div><span>状态</span><select value={project.status} onChange={(event) => onUpdateProject({ ...project, status: event.target.value as ProjectStatus })}>{projectStatusOptions.map((option) => <option key={option} value={option}>{projectStatusLabels[option]}</option>)}</select></div><div><span>分类</span><strong>{getSubCategoryLabel(project.mainCategory, project.subCategory)}</strong></div><div><span>总时长</span><strong>{formatDuration(total)}</strong></div><div><span>最近记录</span><strong>{latest ? formatDateTime(latest.startTime) : '暂无记录'}</strong></div><div><span>下次提醒</span><strong>{nextPlan ? formatDateTime(nextPlan.deadline || nextPlan.createdAt) : '暂无提醒'}</strong></div></div></section><section className="notebook-toolbar"><button className="primary-button compact" disabled={Boolean(activeTimer)} onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory: project.mainCategory, subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button><label><span>提醒时间</span><input type="datetime-local" value={reminderTime} onChange={(event) => setReminderTime(event.target.value)} /></label><label><span>提醒内容</span><input value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder={'进行 ' + project.name} /></label><button className="secondary-button compact" onClick={addReminder}>保存提醒</button></section><ProjectNotebook project={project} sessions={sessions} journalEntries={journalEntries} onSaveJournalEntry={onSaveJournalEntry} /><section className="notion-block legacy-images"><details><summary>历史图片</summary>{images.length > 0 ? <div className="image-grid">{images.map((image) => <figure key={image.id}><img src={image.data} alt={image.caption || T.projectImages} />{image.caption ? <figcaption>{image.caption}</figcaption> : null}</figure>)}</div> : <p className="empty-text">暂无历史图片</p>}</details></section></div>;
}

function ProjectNotebook({ project, sessions, journalEntries, onSaveJournalEntry }: {
  project: Project;
  sessions: Session[];
  journalEntries: ProjectJournalEntry[];
  onSaveJournalEntry: (entry: ProjectJournalEntry) => Promise<void>;
}) {
  const today = toDateKey(new Date());
  const entryByDate = new Map(journalEntries.map((entry) => [entry.date, entry]));
  const archivedEntries = journalEntries
    .filter((entry) => entry.date !== today && hasMeaningfulJournalContent(entry.contentHtml))
    .sort((a, b) => b.date.localeCompare(a.date));
  const entriesToShow = [today, ...archivedEntries.map((entry) => entry.date)];

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
  const [contentHtml, setContentHtml] = useState(entry?.contentHtml ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => setContentHtml(entry?.contentHtml ?? ''), [entry?.id, entry?.contentHtml, date]);
  useEffect(() => () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current); }, []);

  const save = async (nextContentHtml: string) => {
    if (!hasMeaningfulJournalContent(nextContentHtml) && !entry) return;
    setSaveState('saving');
    const timestamp = nowIso();
    await onSaveJournalEntry({ id: entry?.id ?? createId(), projectId: project.id, date, contentHtml: nextContentHtml, createdAt: entry?.createdAt ?? timestamp, updatedAt: timestamp });
    setSaveState('saved');
  };

  const scheduleSave = (nextContentHtml: string) => {
    setContentHtml(nextContentHtml);
    setSaveState(hasMeaningfulJournalContent(nextContentHtml) ? 'saving' : 'idle');
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void save(nextContentHtml), 700);
  };

  return (
    <article className="daily-journal-page paper-journal-page">
      <header>
        <h4>{formatJournalDate(date)}</h4>
        <span>{saveState === 'saving' ? '\u6b63\u5728\u81ea\u52a8\u4fdd\u5b58' : saveState === 'saved' ? '\u5df2\u81ea\u52a8\u4fdd\u5b58' : sessions.length > 0 ? sessions.length + ' \u6761\u65f6\u95f4\u8bb0\u5f55' : ''}</span>
      </header>
      <NotebookEditor value={contentHtml} onChange={scheduleSave} />
      <DailySessionSummary sessions={sessions} />
    </article>
  );
}

function NotebookEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
        data-placeholder={'\u4eca\u5929\u8fd8\u6ca1\u6709\u5199\u5185\u5bb9\uff0c\u53ef\u4ee5\u76f4\u63a5\u4ece\u8fd9\u91cc\u5f00\u59cb\u3002\u590d\u5236\u56fe\u7247\u540e\u7c98\u8d34\u5230\u8fd9\u91cc\u4e5f\u53ef\u4ee5\u3002'}
      />
    </div>
  );
}

function DailySessionSummary({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) return null;
  return <div className="daily-session-summary"><h5>{'\u5f53\u5929\u65f6\u95f4\u8bb0\u5f55'}</h5>{sessions.map((session) => <div className="daily-session-card" key={session.id}><strong>{formatTimeOnly(session.startTime)} - {formatTimeOnly(session.endTime)} / {formatDuration(session.durationMinutes)}</strong>{session.content ? <span>{session.content}</span> : null}{session.feelings ? <em>{session.feelings}</em> : null}</div>)}</div>;
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

function BasicPage({ title, description, mainCategory, projects, onCreateProject, onStartTimer, onManualSession }: {
  title: string;
  description: string;
  mainCategory: MainCategory;
  projects: Project[];
  onCreateProject: (input: { name: string; mainCategory: MainCategory; subCategory: string; status?: ProjectStatus; imageUrl?: string }) => Promise<Project>;
  onStartTimer: (project: Project) => Promise<void>;
  onManualSession: (preset: ManualPreset) => void;
}) {
  const [name, setName] = useState('');
  const categoryProjects = projects.filter((project) => project.mainCategory === mainCategory);
  const create = async () => { if (!name.trim()) return; await onCreateProject({ name, mainCategory, subCategory: 'general', status: 'active' }); setName(''); };
  return <div className="placeholder-grid"><section className="panel"><h2>{title}</h2><p className="muted">{description}</p><div className="inline-form"><label className="stacked-field"><span>{T.projectName}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={T.createBasicProject} /></label><button className="primary-button" onClick={create}>{T.createProject}</button></div></section><section className="panel span-2"><h2>{T.basicEntry}</h2>{categoryProjects.length === 0 ? <p className="empty-text">{T.noProject}</p> : <div className="project-list horizontal">{categoryProjects.map((project) => <div className="simple-project" key={project.id}><strong>{project.name}</strong><div className="detail-actions"><button className="primary-button compact" onClick={() => onStartTimer(project)}>{T.startTimer}</button><button className="secondary-button compact" onClick={() => onManualSession({ mainCategory, subCategory: project.subCategory, projectId: project.id })}>{T.manualSession}</button></div></div>)}</div>}</section></div>;
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
