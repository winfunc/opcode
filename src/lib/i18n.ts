import { createContext, useContext } from 'react';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = {
  en: 'English',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  pt: 'Português',
  it: 'Italiano',
  ar: 'العربية',
  hi: 'हिन्दी'
} as const;

export type Language = keyof typeof SUPPORTED_LANGUAGES;

// 翻译键的类型定义
export interface Translations {
  // 通用
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    add: string;
    remove: string;
    back: string;
    next: string;
    previous: string;
    loading: string;
    error: string;
    success: string;
    warning: string;
    info: string;
    confirm: string;
    yes: string;
    no: string;
    ok: string;
    close: string;
    open: string;
    settings: string;
    search: string;
    filter: string;
    sort: string;
    refresh: string;
    copy: string;
    paste: string;
    cut: string;
    undo: string;
    redo: string;
    select: string;
    selectAll: string;
    clear: string;
    reset: string;
    apply: string;
    submit: string;
    create: string;
    update: string;
    upload: string;
    download: string;
    import: string;
    export: string;
    help: string;
    about: string;
    version: string;
    language: string;
    theme: string;
    profile: string;
    account: string;
    logout: string;
    login: string;
    register: string;
    forgotPassword: string;
    changePassword: string;
    email: string;
    password: string;
    username: string;
    name: string;
    firstName: string;
    lastName: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    zipCode: string;
    date: string;
    time: string;
    dateTime: string;
    today: string;
    yesterday: string;
    tomorrow: string;
    thisWeek: string;
    lastWeek: string;
    nextWeek: string;
    thisMonth: string;
    lastMonth: string;
    nextMonth: string;
    thisYear: string;
    lastYear: string;
    nextYear: string;
  };

  // 应用标题和导航
  app: {
    title: string;
    welcomeTitle: string;
    welcomeSubtitle: string;
    ccAgents: string;
    ccProjects: string;
    backToHome: string;
    newSession: string;
    usageDashboard: string;
    mcp: string;
    claudeMd: string;
  };

  // 项目相关
  projects: {
    title: string;
    subtitle: string;
    noProjects: string;
    projectName: string;
    projectPath: string;
    createdAt: string;
    sessions: string;
    newClaudeCodeSession: string;
    runningClaudeSessions: string;
    hooks: string;
    projectSettings: string;
  };

  // 会话相关
  sessions: {
    title: string;
    noSessions: string;
    sessionName: string;
    lastModified: string;
    messages: string;
    tokens: string;
    cost: string;
    status: string;
    active: string;
    completed: string;
    failed: string;
    cancelled: string;
  };

  // 设置页面
  settings: {
    title: string;
    subtitle: string;
    saveSettings: string;
    saving: string;
    settingsSaved: string;
    failedToSave: string;
    
    // 标签页
    general: string;
    permissions: string;
    environment: string;
    advanced: string;
    hooks: string;
    commands: string;
    storage: string;
    
    // 通用设置
    generalSettings: string;
    includeCoAuthoredBy: string;
    includeCoAuthoredByDesc: string;
    verboseOutput: string;
    verboseOutputDesc: string;
    chatRetention: string;
    chatRetentionDesc: string;
    claudeInstallation: string;
    claudeInstallationDesc: string;
    binaryPathChanged: string;
    
    // 权限设置
    permissionRules: string;
    permissionRulesDesc: string;
    allowRules: string;
    denyRules: string;
    addRule: string;
    noAllowRules: string;
    noDenyRules: string;
    permissionExamples: string;
    
    // 环境变量
    environmentVariables: string;
    environmentVariablesDesc: string;
    addVariable: string;
    noEnvironmentVariables: string;
    commonVariables: string;
    
    // 高级设置
    advancedSettings: string;
    advancedSettingsDesc: string;
    apiKeyHelper: string;
    apiKeyHelperDesc: string;
    rawSettings: string;
    rawSettingsDesc: string;
    
    // Hooks设置
    userHooks: string;
    userHooksDesc: string;
  };

  // Claude相关
  claude: {
    claudeNotFound: string;
    claudeNotFoundDesc: string;
    selectClaudeInstallation: string;
    installClaude: string;
    checking: string;
    claudeCode: string;
    claudeVersion: string;
    claudeStreaming: string;
    claudeStreamingWarning: string;
    continueNavigation: string;
  };

  // 错误和状态消息
  messages: {
    failedToLoadProjects: string;
    failedToLoadSessions: string;
    ensureClaudeDirectory: string;
    projectLoadError: string;
    sessionLoadError: string;
    saveSuccess: string;
    saveError: string;
    deleteSuccess: string;
    deleteError: string;
    copySuccess: string;
    copyError: string;
    uploadSuccess: string;
    uploadError: string;
    downloadSuccess: string;
    downloadError: string;
    networkError: string;
    serverError: string;
    validationError: string;
    permissionError: string;
    notFoundError: string;
    timeoutError: string;
    unknownError: string;
  };

  // 表单验证
  validation: {
    required: string;
    invalidEmail: string;
    invalidUrl: string;
    invalidNumber: string;
    minLength: string;
    maxLength: string;
    passwordMismatch: string;
    invalidFormat: string;
    fileTooBig: string;
    invalidFileType: string;
  };

  // 时间格式
  time: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    weeksAgo: string;
    monthsAgo: string;
    yearsAgo: string;
    inMinutes: string;
    inHours: string;
    inDays: string;
    inWeeks: string;
    inMonths: string;
    inYears: string;
  };

  // MCP相关
  mcp: {
    title: string;
    subtitle: string;
    servers: string;
    addServer: string;
    serverName: string;
    serverCommand: string;
    serverArgs: string;
    serverEnv: string;
    enabled: string;
    disabled: string;
    autoApprove: string;
    importExport: string;
    importConfig: string;
    exportConfig: string;
    noServers: string;
    serverStatus: string;
    connected: string;
    disconnected: string;
    connecting: string;
    error: string;
  };

  // 使用情况仪表板
  usage: {
    title: string;
    subtitle: string;
    totalTokens: string;
    totalCost: string;
    sessionsCount: string;
    averageCost: string;
    dailyUsage: string;
    weeklyUsage: string;
    monthlyUsage: string;
    yearlyUsage: string;
    topProjects: string;
    recentActivity: string;
    costBreakdown: string;
    tokenBreakdown: string;
    noData: string;
    refreshData: string;
  };

  // CC Agents
  agents: {
    title: string;
    subtitle: string;
    createAgent: string;
    agentName: string;
    agentDescription: string;
    agentPrompt: string;
    agentIcon: string;
    agentSettings: string;
    runAgent: string;
    editAgent: string;
    deleteAgent: string;
    duplicateAgent: string;
    shareAgent: string;
    importAgent: string;
    exportAgent: string;
    noAgents: string;
    agentExecution: string;
    executionHistory: string;
    executionStatus: string;
    executionOutput: string;
    executionError: string;
    executionSuccess: string;
    executionCancelled: string;
    executionRunning: string;
    executionPending: string;
  };
}

// I18n Context
export interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
  isRTL: boolean;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Hook for using i18n
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// 获取浏览器语言
export const getBrowserLanguage = (): Language => {
  const browserLang = navigator.language.split('-')[0] as Language;
  return Object.keys(SUPPORTED_LANGUAGES).includes(browserLang) ? browserLang : 'en';
};

// 检查是否为RTL语言
export const isRTLLanguage = (language: Language): boolean => {
  return ['ar'].includes(language);
};

// 格式化相对时间
export const formatRelativeTime = (timestamp: number, _language: Language, translations: Translations): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return translations.time.justNow;
  if (minutes < 60) return translations.time.minutesAgo.replace('{count}', minutes.toString());
  if (hours < 24) return translations.time.hoursAgo.replace('{count}', hours.toString());
  if (days < 7) return translations.time.daysAgo.replace('{count}', days.toString());
  if (weeks < 4) return translations.time.weeksAgo.replace('{count}', weeks.toString());
  if (months < 12) return translations.time.monthsAgo.replace('{count}', months.toString());
  return translations.time.yearsAgo.replace('{count}', years.toString());
};