import type { ActiveTimer, ExercisePlan, GrowthMetric, GrowthRecord, Project, ProjectImage, ProjectJournalEntry, Session, WeeklyPlan } from './types';

type StoreName = 'projects' | 'sessions' | 'weeklyPlans' | 'projectImages' | 'projectJournalEntries' | 'exercisePlans' | 'growthMetrics' | 'growthRecords' | 'activeTimer';

const DB_NAME = 'personal-management-system';
const DB_VERSION = 3;

let dbPromise: Promise<IDBDatabase> | null = null;

const openDatabase = () => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        store.createIndex('mainCategory', 'mainCategory');
        store.createIndex('subCategory', 'subCategory');
      }
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('mainCategory', 'mainCategory');
        store.createIndex('projectId', 'projectId');
        store.createIndex('startTime', 'startTime');
      }
      if (!db.objectStoreNames.contains('weeklyPlans')) {
        db.createObjectStore('weeklyPlans', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('projectImages')) {
        const store = db.createObjectStore('projectImages', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId');
      }
      if (!db.objectStoreNames.contains('projectJournalEntries')) {
        const store = db.createObjectStore('projectJournalEntries', { keyPath: 'id' });
        store.createIndex('projectId', 'projectId');
        store.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('exercisePlans')) {
        const store = db.createObjectStore('exercisePlans', { keyPath: 'id' });
        store.createIndex('scheduledAt', 'scheduledAt');
        store.createIndex('projectId', 'projectId');
      }
      if (!db.objectStoreNames.contains('growthMetrics')) {
        db.createObjectStore('growthMetrics', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('growthRecords')) {
        const store = db.createObjectStore('growthRecords', { keyPath: 'id' });
        store.createIndex('metricId', 'metricId');
        store.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('activeTimer')) {
        db.createObjectStore('activeTimer', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const getStore = async (storeName: StoreName, mode: IDBTransactionMode) => {
  const db = await openDatabase();
  return db.transaction(storeName, mode).objectStore(storeName);
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const getAll = async <T>(storeName: StoreName) => {
  const store = await getStore(storeName, 'readonly');
  return requestToPromise<T[]>(store.getAll());
};

const put = async <T>(storeName: StoreName, item: T) => {
  const store = await getStore(storeName, 'readwrite');
  await requestToPromise(store.put(item));
};

const remove = async (storeName: StoreName, id: string) => {
  const store = await getStore(storeName, 'readwrite');
  await requestToPromise(store.delete(id));
};

export const storage = {
  getProjects: () => getAll<Project>('projects'),
  saveProject: (project: Project) => put('projects', project),
  deleteProject: (id: string) => remove('projects', id),
  getSessions: () => getAll<Session>('sessions'),
  saveSession: (session: Session) => put('sessions', session),
  getWeeklyPlans: () => getAll<WeeklyPlan>('weeklyPlans'),
  saveWeeklyPlan: (plan: WeeklyPlan) => put('weeklyPlans', plan),
  deleteWeeklyPlan: (id: string) => remove('weeklyPlans', id),
  getProjectImages: () => getAll<ProjectImage>('projectImages'),
  saveProjectImage: (image: ProjectImage) => put('projectImages', image),
  deleteProjectImage: (id: string) => remove('projectImages', id),
  getProjectJournalEntries: () => getAll<ProjectJournalEntry>('projectJournalEntries'),
  saveProjectJournalEntry: (entry: ProjectJournalEntry) => put('projectJournalEntries', entry),
  deleteProjectJournalEntry: (id: string) => remove('projectJournalEntries', id),
  getExercisePlans: () => getAll<ExercisePlan>('exercisePlans'),
  saveExercisePlan: (plan: ExercisePlan) => put('exercisePlans', plan),
  deleteExercisePlan: (id: string) => remove('exercisePlans', id),
  getGrowthMetrics: () => getAll<GrowthMetric>('growthMetrics'),
  saveGrowthMetric: (metric: GrowthMetric) => put('growthMetrics', metric),
  deleteGrowthMetric: (id: string) => remove('growthMetrics', id),
  getGrowthRecords: () => getAll<GrowthRecord>('growthRecords'),
  saveGrowthRecord: (record: GrowthRecord) => put('growthRecords', record),
  deleteGrowthRecord: (id: string) => remove('growthRecords', id),
  getActiveTimer: async () => {
    const timers = await getAll<ActiveTimer>('activeTimer');
    return timers[0] ?? null;
  },
  saveActiveTimer: async (timer: ActiveTimer) => {
    const existing = await getAll<ActiveTimer>('activeTimer');
    await Promise.all(existing.map((item) => remove('activeTimer', item.id)));
    await put('activeTimer', timer);
  },
  clearActiveTimer: async () => {
    const existing = await getAll<ActiveTimer>('activeTimer');
    await Promise.all(existing.map((item) => remove('activeTimer', item.id)));
  },
};
