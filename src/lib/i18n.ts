import { createContext, useContext } from "react";

/**
 * Supported languages configuration
 *
 * Maps language codes to their display names in their native language.
 * Used for language selection UI and internationalization.
 */
export const SUPPORTED_LANGUAGES = {
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ru: "Русский",
  pt: "Português",
  it: "Italiano",
  ar: "العربية",
  hi: "हिन्दी",
} as const;

/**
 * Language code type derived from supported languages
 */
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
    select: string;
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
    email: string;
    password: string;
    username: string;
    name: string;
    date: string;
    time: string;
    dateTime: string;
    today: string;
    projectPath: string;
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
    fullscreen: string;
    close: string;
  };

  // CLAUDE.md 编辑器
  claudemd: {
    title: string;
    subtitle: string;
    editSystemPrompt: string;
    editProjectPrompt: string;
    failedToLoad: string;
    failedToSave: string;
    savedSuccessfully: string;
    unsavedChanges: string;
    memories: string;
    noFilesFound: string;
    loadingFiles: string;
    failedToLoadFiles: string;
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
    deleteSession: string;
    deleteSessionConfirm: string;
    deleteSessionDesc: string;
    deletingSession: string;
    sessionDeleted: string;
    failedToDeleteSession: string;
    lastModified: string;
    messages: string;
    tokens: string;
    cost: string;
    status: string;
    active: string;
    completed: string;
    failed: string;
    cancelled: string;
    claudeCodeSession: string;
    commands: string;
    copyOutput: string;
    slashCommands: string;
    manageProjectSpecificSlashCommands: string;
    checkpointSettings: string;
    close: string;
    experimentalFeature: string;
    checkpointingWarning: string;
    automaticCheckpoints: string;
    automaticCheckpointsDesc: string;
    checkpointStrategy: string;
    smartRecommended: string;
    smartStrategyDesc: string;
    saveSettings: string;
    storageManagement: string;
    totalCheckpoints: string;
    keepRecentCheckpoints: string;
    cleanUp: string;
    removeOldCheckpoints: string;
    sessionTimeline: string;
    timeline: string;
    noCheckpointsYet: string;
    loadingTimeline: string;
    copyAsMarkdown: string;
    copyAsJsonl: string;
    checkpointSettingsTooltip: string;
    timelineNavigatorTooltip: string;
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
    choosePreferredInstallation: string;
    availableInstallations: string;
    selectedInstallation: string;
    bundled: string;
    system: string;
    custom: string;
    path: string;
    source: string;
    version: string;
    claudeCodeBundled: string;
    loadingInstallations: string;
    selectClaudeInstallation: string;
    pleaseSelectInstallation: string;
    multipleInstallationsFound: string;
    claudeNotFoundInLocations: string;
    searchingForInstallations: string;
    installationGuide: string;
    saveSelection: string;
    noInstallationsFound: string;
    validating: string;
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

    // 音频提示设置
    audioNotifications: string;
    audioNotificationsDesc: string;
    audioNotificationMode: string;
    audioNotificationModeDesc: string;
    audioModeOff: string;
    audioModeOnMessage: string;
    audioModeOnQueue: string;
    audioModeOffDesc: string;
    audioModeOnMessageDesc: string;
    audioModeOnQueueDesc: string;
    testAudio: string;
    testAudioDesc: string;
    playTestSound: string;

    // Hooks设置
    userHooks: string;
    userHooksDesc: string;

    // 权限示例
    allowAllBashCommands: string;
    allowExactCommand: string;
    allowCommandsWithPrefix: string;
    allowReadingSpecificFile: string;
    allowEditingFilesInDocsDirectory: string;

    // 环境变量示例
    enableDisableTelemetry: string;
    customModelName: string;
    disableCostWarnings: string;

    // 主题设置
    theme: string;
    themeDesc: string;
    selectTheme: string;
    themeDark: string;
    themeGray: string;
    themeLight: string;
    themeCustom: string;
    customThemeColors: string;
    colorBackground: string;
    colorForeground: string;
    colorCard: string;
    colorCardForeground: string;
    colorPrimary: string;
    colorPrimaryForeground: string;
    colorSecondary: string;
    colorSecondaryForeground: string;
    colorMuted: string;
    colorMutedForeground: string;
    colorAccent: string;
    colorAccentForeground: string;
    colorDestructive: string;
    colorDestructiveForeground: string;
    colorBorder: string;
    colorInput: string;
    colorRing: string;

    // 字体缩放设置
    fontScale: string;
    fontScaleDesc: string;
    fontScaleSmall: string;
    fontScaleNormal: string;
    fontScaleLarge: string;
    fontScaleExtraLarge: string;
    fontScaleCustom: string;
    fontScaleSmallDesc: string;
    fontScaleNormalDesc: string;
    fontScaleLargeDesc: string;
    fontScaleExtraLargeDesc: string;
    fontScaleCustomDesc: string;
    customMultiplier: string;
    customMultiplierDesc: string;
    customMultiplierPlaceholder: string;
    customMultiplierRange: string;

    // 其他缺失的键
    examples: string;
    failedToLoadSettings: string;
    settingsSavedSuccessfully: string;
    failedToSaveSettings: string;
    refresh: string;
    
    // 环境变量分组相关
    addGroup: string;
    noVariablesInGroup: string;
    ungroupedVariables: string;
    duplicateKeyInUngroupedVariables: string;
    cssColorValuesDesc: string;
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

  validation: {
    required: string;
  };

  // 时间格式
  time: {
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
    daysAgo: string;
    yesterday: string;
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
    // 新增MCP相关翻译
    mcpServers: string;
    manageServers: string;
    serverConfiguration: string;
    addNewServer: string;
    editServer: string;
    removeServer: string;
    serverDetails: string;
    connectionStatus: string;
    serverLogs: string;
    testConnection: string;
    reconnect: string;
    disconnect: string;
    serverPort: string;
    serverHost: string;
    authToken: string;
    timeout: string;
    retryAttempts: string;
    enableLogging: string;
    logLevel: string;
    serverType: string;
    protocol: string;
    version: string;
    capabilities: string;
    tools: string;
    resources: string;
    prompts: string;
    sampling: string;
    roots: string;
    experimental: string;
    serverInfo: string;
    lastSeen: string;
    uptime: string;
    requestCount: string;
    errorCount: string;
    averageResponseTime: string;
    // 添加缺失的MCP翻译键
    serverNameRequired: string;
    commandRequired: string;
    urlRequired: string;
    uniqueServerName: string;
    command: string;
    commandToExecute: string;
    commandArguments: string;
    spaceSeparatedArgs: string;
    scope: string;
    localProjectOnly: string;
    projectSharedMcp: string;
    userAllProjects: string;
    environmentVariables: string;
    addVariable: string;
    addStdioServer: string;
    addSseServer: string;
    addingServer: string;
    stdio: string;
    sse: string;
    url: string;
    sseEndpointUrl: string;
    exampleCommands: string;
    addMcpServer: string;
    configureMcpServer: string;
    // MCPServerList相关
    configuredServers: string;
    serversConfigured: string;
    refresh: string;
    noMcpServersConfigured: string;
    addServerToGetStarted: string;
    running: string;
    showFull: string;
    hide: string;
    environmentVariablesCount: string;
    arguments: string;
    copy: string;
    copied: string;
    localProjectSpecific: string;
    projectSharedViaMcp: string;
    userAllProjectsScope: string;
    // MCPImportExport相关
    importExportTitle: string;
    importExportSubtitle: string;
    importScope: string;
    chooseImportScope: string;
    importFromClaudeDesktop: string;
    importFromClaudeDesktopDesc: string;
    importing: string;
    importFromJson: string;
    importFromJsonDesc: string;
    chooseJsonFile: string;
    exportConfiguration: string;
    exportConfigurationDesc: string;
    exportComingSoon: string;
    useClaudeCodeAsMcp: string;
    useClaudeCodeAsMcpDesc: string;
    startMcpServer: string;
    jsonFormatExamples: string;
    singleServer: string;
    multipleServers: string;
    invalidJsonFile: string;
    enterServerName: string;
    unrecognizedJsonFormat: string;
    failedToImportJson: string;
    exportFunctionalityComingSoon: string;
    claudeCodeMcpServerStarted: string;
    failedToStartMcpServer: string;
    successfullyImported: string;
    failedToImportSomeServers: string;
    failedToImportFromClaudeDesktop: string;
    // MCPManager相关
    failedToLoadServers: string;
    serverAddedSuccessfully: string;
    serverRemovedSuccessfully: string;
    importedServersSuccess: string;
    importedServersPartial: string;
    mcpManagerTitle: string;
    mcpManagerSubtitle: string;
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
    // 新增使用情况仪表板翻译键
    loadingStats: string;
    tryAgain: string;
    allTime: string;
    last7Days: string;
    last30Days: string;
    overview: string;
    byModel: string;
    byProject: string;
    bySessions: string;
    timeline: string;
    inputTokens: string;
    outputTokens: string;
    cacheWrite: string;
    cacheRead: string;
    mostUsedModels: string;
    usageByModel: string;
    usageByProject: string;
    usageBySession: string;
    dailyUsageOverTime: string;
    noUsageData: string;
    sessions: string;
    tokens: string;
    input: string;
    output: string;
    avgCostPerSession: string;
    modelsUsed: string;
    // 新增缺失的翻译键
    trackUsageAndCosts: string;
    totalSessions: string;
    tokenBreakdownTitle: string;
    failedToLoadUsageStats: string;
    noUsageDataForPeriod: string;
    cacheWriteShort: string;
    cacheReadShort: string;
    model: string;
    models: string;
  };

  // CC Agents
  agents: {
    title: string;
    subtitle: string;
    agentManagement: string;
    createNewAgentsOrManage: string;
    availableAgents: string;
    runningAgents: string;
    noAgentsAvailable: string;
    createFirstAgentToGetStarted: string;
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
    // 创建智能体界面翻译
    editCCAgent: string;
    createCCAgent: string;
    updateAgent: string;
    createNewAgent: string;
    basicInformation: string;
    model: string;
    claude4Sonnet: string;
    claude4Opus: string;
    claude35Haiku: string;
    claude35Sonnet: string;
    claude37Sonnet: string;
    claude37SonnetThinkingDesc: string;
    claude4SonnetThinkingDesc: string;
    claude4OpusThinkingDesc: string;
    fasterEfficient: string;
    moreCapable: string;
    fastAffordable: string;
    balancedPerformance: string;
    advancedReasoning: string;
    defaultTask: string;
    defaultTaskPlaceholder: string;
    defaultTaskDesc: string;
    systemPrompt: string;
    systemPromptDesc: string;
    agentNamePlaceholder: string;
    unsavedChanges: string;
    agentNameRequired: string;
    systemPromptRequired: string;
    failedToCreateAgent: string;
    failedToUpdateAgent: string;
    saving: string;
    // 新增 CC 智能体界面翻译键
    noAgentsYet: string;
    createFirstAgent: string;
    execute: string;
    edit: string;
    export: string;
    created: string;
    recentExecutions: string;
    importFromFile: string;
    importFromGitHub: string;
    agentExportedSuccessfully: string;
    agentImportedSuccessfully: string;
    agentImportedFromGitHub: string;
    deleteAgentTitle: string;
    deleteAgentConfirm: string;
    deleteAgentDesc: string;
    deletingAgent: string;
    deleteAgentButton: string;
    cancel: string;
    // 额外的 CC 智能体翻译键
    manageAgents: string;
    createCCAgentButton: string;
    agentDeletedSuccessfully: string;
    failedToDeleteAgent: string;
    failedToLoadAgents: string;
    failedToExportAgent: string;
    failedToImportAgent: string;
    agentCreatedSuccessfully: string;
    agentUpdatedSuccessfully: string;
    executeAgent: string;
    exportAgentToFile: string;
    fromFile: string;
    fromGitHub: string;
    createFirstAgentDesc: string;
    ccAgentsTitle: string;
    page: string;
    of: string;
    deleteAgentConfirmation: string;
    deleting: string;
    // 定价相关翻译
    pricing: string;
    pricingInfo: string;
    inputTokens: string;
    outputTokens: string;
    cacheWrite: string;
    cacheRead: string;
    perMillionTokens: string;
    costEfficiency: string;
    highEfficiency: string;
    mediumEfficiency: string;
    lowEfficiency: string;
    recommendedUseCases: string;
    costEstimate: string;
    pricingDetails: string;
    basedOnOfficialPricing: string;
    // 新增缺失的翻译键
    allAgents: string;
    claudia: string;
    native: string;
    running: string;
    createClaudiaAgent: string;
    noClaudiaAgents: string;
    createFirstClaudiaAgent: string;
    nativeAgentsInfo: string;
    importNativeAgents: string;
    cleanDatabase: string;
    noNativeAgentsFound: string;
    nativeAgentsDesc: string;
    noRunningAgents: string;
    agentExecutionsWillAppear: string;
    started: string;
    view: string;
    // AgentExecution interface translations
    task: string;
    selectOrEnterProjectPath: string;
    configureHooks: string;
    hooks: string;
    enterTaskForAgent: string;
    readyToExecute: string;
    selectProjectPathAndTask: string;
    initializingAgent: string;
    output: string;
    copyOutput: string;
    copyAsJsonl: string;
    copyAsMarkdown: string;
    configureHooksDesc: string;
    projectSettings: string;
    localSettings: string;
    stop: string;
  };

  // Thinking modes for Claude AI interaction
  thinkingModes: {
    auto: string;
    autoDescription: string;
    think: string;
    thinkDescription: string;
    thinkHard: string;
    thinkHardDescription: string;
    thinkHarder: string;
    thinkHarderDescription: string;
    ultrathink: string;
    ultrathinkDescription: string;
  };

  // 钩子编辑器翻译
  hooks: {
    title: string;
    subtitle: string;
    scope: string;
    projectScope: string;
    localScope: string;
    userScope: string;
    localScopeDesc: string;
    unsavedChanges: string;
    validationErrors: string;
    securityWarnings: string;
    templates: string;
    preToolUse: string;
    postToolUse: string;
    notification: string;
    stop: string;
    subagentStop: string;
    preToolUseDesc: string;
    postToolUseDesc: string;
    notificationDesc: string;
    stopDesc: string;
    subagentStopDesc: string;
    pattern: string;
    patternPlaceholder: string;
    patternTooltip: string;
    commonPatterns: string;
    custom: string;
    commands: string;
    addCommand: string;
    noCommandsAdded: string;
    commandPlaceholder: string;
    seconds: string;
    noHooksConfigured: string;
    addHook: string;
    addMatcher: string;
    removeMatcher: string;
    removeCommand: string;
    loadingHooks: string;
    savingHooks: string;
    hooksConfiguration: string;
    chooseTemplate: string;
  };

  // 斜杠命令管理器翻译
  commands: {
    title: string;
    subtitle: string;
    projectCommands: string;
    projectCommandsDesc: string;
    newCommand: string;
    searchCommands: string;
    allCommands: string;
    project: string;
    user: string;
    noCommandsFound: string;
    noProjectCommands: string;
    noCommandsCreated: string;
    createFirstProjectCommand: string;
    createFirstCommand: string;
    editCommand: string;
    createNewCommand: string;
    commandName: string;
    commandNamePlaceholder: string;
    namespace: string;
    namespacePlaceholder: string;
    description: string;
    descriptionPlaceholder: string;
    commandContent: string;
    contentPlaceholder: string;
    contentDesc: string;
    allowedTools: string;
    allowedToolsDesc: string;
    examples: string;
    preview: string;
    arguments: string;
    deleteCommand: string;
    deleteCommandConfirm: string;
    deleteCommandDesc: string;
    deleting: string;
    scope: string;
    userGlobal: string;
    availableAcrossProjects: string;
    onlyAvailableInProject: string;
    userCommands: string;
    tools: string;
    bash: string;
    files: string;
    showContent: string;
    hideContent: string;
  };

  // NFO界面翻译
  nfo: {
    title: string;
    credits: string;
    poweredBy: string;
    runtime: string;
    uiFramework: string;
    styling: string;
    animations: string;
    buildTool: string;
    packageManager: string;
    specialThanks: string;
    openSourceCommunity: string;
    betaTesters: string;
    believers: string;
    sharing: string;
    support: string;
    fileABug: string;
    strategicProject: string;
    dependencies: string;
  };

  // 存储界面翻译
  storage: {
    title: string;
    subtitle: string;
    totalSize: string;
    projects: string;
    sessions: string;
    cache: string;
    logs: string;
    settings: string;
    cleanup: string;
    cleanupDesc: string;
    cleanupOlderThan: string;
    days: string;
    cleanupNow: string;
    cleanupSuccess: string;
    cleanupError: string;
    calculating: string;
    noData: string;
    storageLocation: string;
    openInFinder: string;
    exportData: string;
    importData: string;
    backupData: string;
    restoreData: string;
    dataIntegrity: string;
    checkIntegrity: string;
    repairData: string;
    integrityCheck: string;
    integrityOk: string;
    integrityIssues: string;
    autoCleanup: string;
    autoCleanupDesc: string;
    enableAutoCleanup: string;
    cleanupInterval: string;

    // 数据库存储特定翻译
    databaseStorage: string;
    sqlQuery: string;
    resetDB: string;
    selectTable: string;
    searchInTable: string;
    newRow: string;
    rows: string;
    actions: string;
    editRow: string;
    updateRowDesc: string;
    primaryKey: string;
    type: string;
    notNull: string;
    default: string;
    cancel: string;
    update: string;
    newRowTitle: string;
    addNewRowDesc: string;
    required: string;
    insert: string;
    deleteRow: string;
    deleteRowConfirm: string;
    delete: string;
    resetDatabase: string;
    resetDatabaseDesc: string;
    resetWarning: string;
    sqlQueryEditor: string;
    sqlQueryEditorDesc: string;
    sqlQueryPlaceholder: string;
    queryExecutedSuccess: string;
    lastInsertId: string;
    showingRows: string;
    page: string;
    previous: string;
    next: string;
    failedToLoadTables: string;
    failedToLoadTableData: string;
    failedToUpdateRow: string;
    failedToDeleteRow: string;
    failedToInsertRow: string;
    failedToExecuteSQL: string;
    failedToResetDatabase: string;
    databaseResetComplete: string;
    resetFailed: string;
    nullValue: string;
    trueValue: string;
    falseValue: string;
  };

  // 代理设置翻译
  proxy: {
    title: string;
    subtitle: string;
    enableProxy: string;
    enableProxyDesc: string;
    httpProxy: string;
    httpsProxy: string;
    noProxy: string;
    noProxyDesc: string;
    allProxy: string;
    allProxyDesc: string;
    httpProxyPlaceholder: string;
    httpsProxyPlaceholder: string;
    noProxyPlaceholder: string;
    allProxyPlaceholder: string;
    settingsSaved: string;
    settingsFailed: string;
    loadFailed: string;
  };

  // 分析同意翻译
  analytics: {
    title: string;
    subtitle: string;
    helpImproveClaudia: string;
    collectAnonymousData: string;
    whatWeCollect: string;
    featureUsage: string;
    performanceMetrics: string;
    errorReports: string;
    usagePatterns: string;
    privacyProtected: string;
    noPersonalInfo: string;
    noFileContents: string;
    noApiKeys: string;
    anonymousIds: string;
    optOutAnytime: string;
    dataHelpsUs: string;
    noThanks: string;
    allowAnalytics: string;
    helpImprove: string;
    noPersonalData: string;
    allow: string;
    enableAnalytics: string;
    analyticsSettings: string;
    privacyInfo: string;
    dataCollection: string;
    deleteAllData: string;
    analyticsEnabled: string;
    analyticsDisabled: string;
    allDataDeleted: string;
  };
}

// I18n Context
export interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translations;
  isRTL: boolean;
}

/**
 * React context for internationalization
 *
 * Provides language state, translation functions, and RTL support
 * throughout the application component tree.
 */
export const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * Hook for accessing internationalization context
 *
 * Provides access to current language, translation function, and RTL state.
 * Must be used within an I18nProvider component.
 *
 * @returns I18n context with language state and translation functions
 * @throws Error if used outside I18nProvider
 *
 * @example
 * ```tsx
 * const { t, language, setLanguage } = useI18n();
 * return <h1>{t.common.welcome}</h1>;
 * ```
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};

/**
 * Get the browser's preferred language
 *
 * Detects the user's browser language and returns a supported language code.
 * Falls back to English if the browser language is not supported.
 *
 * @returns Supported language code based on browser preference
 *
 * @example
 * ```typescript
 * const browserLang = getBrowserLanguage();
 * // Returns 'zh' for Chinese browsers, 'en' for unsupported languages
 * ```
 */
export const getBrowserLanguage = (): Language => {
  const browserLang = navigator.language.split("-")[0] as Language;
  return Object.keys(SUPPORTED_LANGUAGES).includes(browserLang) ? browserLang : "en";
};

/**
 * Check if a language uses right-to-left text direction
 *
 * @param language - Language code to check
 * @returns True if the language uses RTL text direction
 *
 * @example
 * ```typescript
 * isRTLLanguage('ar') // true (Arabic)
 * isRTLLanguage('en') // false (English)
 * ```
 */
export const isRTLLanguage = (language: Language): boolean => {
  return ["ar"].includes(language);
};

/**
 * Format relative time using localized strings
 *
 * Converts a timestamp to a human-readable relative time string
 * using the provided translations (e.g., "2 hours ago", "just now").
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @param _language - Language code (currently unused but reserved for future locale-specific formatting)
 * @param translations - Translation object containing time-related strings
 * @returns Localized relative time string
 *
 * @example
 * ```typescript
 * const relativeTime = formatRelativeTime(
 *   Date.now() - 3600000,
 *   'en',
 *   translations
 * );
 * // Returns: "1 hour ago" (in the specified language)
 * ```
 */
export const formatRelativeTime = (
  timestamp: number,
  _language: Language,
  translations: Translations
): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return translations.time.justNow;
  if (minutes < 60) return translations.time.minutesAgo.replace("{count}", minutes.toString());
  if (hours < 24) return translations.time.hoursAgo.replace("{count}", hours.toString());
  return translations.time.daysAgo.replace("{count}", days.toString());
};
