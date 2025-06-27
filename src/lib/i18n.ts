// 国际化系统
export type Language = 'en' | 'zh';

export interface Translations {
  // 通用
  back: string;
  save: string;
  cancel: string;
  loading: string;
  error: string;
  success: string;
  
  // 欢迎页面
  welcomeToClaudia: string;
  ccAgents: string;
  ccProjects: string;
  
  // 导航和菜单
  usageDashboard: string;
  claudeMd: string;
  mcp: string;
  settings: string;
  
  // 使用情况仪表板
  trackUsageAndCosts: string;
  allTime: string;
  last30Days: string;
  last7Days: string;
  totalCost: string;
  totalSessions: string;
  totalTokens: string;
  avgCostPerSession: string;
  overview: string;
  byModel: string;
  byProject: string;
  bySession: string;
  timeline: string;
  tokenBreakdown: string;
  inputTokens: string;
  outputTokens: string;
  cacheWrite: string;
  cacheRead: string;
  mostUsedModels: string;
  topProjects: string;
  sessions: string;
  loadingUsageStats: string;
  tryAgain: string;
  
  // 设置页面
  configureClaudeCodePreferences: string;
  saveSettings: string;
  general: string;
  permissions: string;
  environment: string;
  advanced: string;
  generalSettings: string;
  includeCoAuthoredByClaude: string;
  addClaudeAttributionToGit: string;
  verboseOutput: string;
  showFullBashAndCommandOutputs: string;
  chatTranscriptRetentionDays: string;
  howLongToRetainChatTranscripts: string;
  claudeCodeInstallation: string;
  selectWhichClaudeCodeInstallation: string;
  
  // 项目页面
  browseYourClaudeCodeSessions: string;
  backToHome: string;
  newClaudeCodeSession: string;
  noProjectsFound: string;
  
  // 错误和状态
  failedToLoadProjects: string;
  failedToLoadSessions: string;
  failedToCreateSession: string;
  
  // CC Agents 页面
  ccAgentsTitle: string;
  createNewAgent: string;
  importAgent: string;
  exportAgent: string;
  browseGitHubAgents: string;
  viewRunningAgents: string;
  agentRuns: string;
  edit: string;
  delete: string;
  run: string;
  export: string;
  duplicate: string;
  created: string;
  lastRun: string;
  totalRuns: string;
  
  // 创建代理
  createAgent: string;
  agentName: string;
  agentDescription: string;
  agentInstructions: string;
  selectIcon: string;
  selectModel: string;
  createAgentButton: string;
  
  // 通用操作
  create: string;
  import: string;
  browse: string;
  view: string;
  close: string;
  refresh: string;
  search: string;
  filter: string;
  sort: string;
  clear: string;
  reset: string;
  apply: string;
  confirm: string;
  
  // 状态和消息
  running: string;
  stopped: string;
  completed: string;
  failed: string;
  pending: string;
  noDataFound: string;
  loadingData: string;
  operationSuccessful: string;
  operationFailed: string;
  
  // 文件操作
  selectFile: string;
  selectFolder: string;
  uploadFile: string;
  downloadFile: string;
  saveFile: string;
  openFile: string;
  
  // 时间和日期
  createdAt: string;
  updatedAt: string;
  lastModified: string;
  duration: string;
  
  // 代理执行
  executeAgent: string;
  executionLog: string;
  executionResult: string;
  selectProjectDirectory: string;
  
  // MCP 相关
  mcpServers: string;
  addServer: string;
  removeServer: string;
  serverStatus: string;
  connected: string;
  disconnected: string;
  
  // 更多通用文本
  name: string;
  description: string;
  instructions: string;
  basicInformation: string;
  systemPrompt: string;
  defaultTask: string;
  optional: string;
  required: string;
  enabled: string;
  disabled: string;
  
  // 代理相关
  editAgent: string;
  updateAgent: string;
  agentNameRequired: string;
  systemPromptRequired: string;
  createNewCCAgent: string;
  updateCCAgent: string;
  agentCreatedSuccessfully: string;
  agentUpdatedSuccessfully: string;
  failedToCreateAgent: string;
  failedToUpdateAgent: string;
  unsavedChanges: string;
  confirmLeave: string;
  saving: string;
  
  // 执行相关
  executeAgentTitle: string;
  projectDirectory: string;
  taskDescription: string;
  selectProjectPath: string;
  enterTaskDescription: string;
  startExecution: string;
  stopExecution: string;
  executionOutput: string;
  executionStats: string;
  elapsedTime: string;
  totalTokensUsed: string;
  copyAsJsonl: string;
  copyAsMarkdown: string;
  fullscreenMode: string;
  exitFullscreen: string;
  
  // 错误边界
  errorOccurred: string;
  errorDetails: string;
  tryAgainButton: string;
  
  // MCP 管理
  manageMCPServers: string;
  mcpServerManagement: string;
  servers: string;
  addServerTab: string;
  importExportTab: string;
  failedToLoadMCPServers: string;
  mcpServerAddedSuccessfully: string;
  serverRemovedSuccessfully: string;
  importedServersSuccessfully: string;
  
  // 文件选择
  selectPath: string;
  chooseDirectory: string;
  chooseFile: string;
  
  // 确认对话框
  deleteConfirmation: string;
  deleteAgentConfirmation: string;
  areYouSure: string;
  thisActionCannotBeUndone: string;
  
  // 分页
  page: string;
  of: string;
  itemsPerPage: string;
  noItemsFound: string;
  
  // 模型选择
  claudeSonnet: string;
  claudeOpus: string;
  recommended: string;
  
  // 权限设置
  allowRules: string;
  denyRules: string;
  addRule: string;
  removeRule: string;
  
  // 环境变量
  environmentVariables: string;
  addEnvironmentVariable: string;
  removeEnvironmentVariable: string;
  key: string;
  value: string;
  
      // 高级设置
    advancedSettings: string;
    apiKeyHelper: string;
    apiKeyHelperScript: string;
    
    // 权限页面
    permissionRules: string;
    controlWhichToolsClaudeCodeCanUse: string;
    noAllowRulesConfigured: string;
    noDenyRulesConfigured: string;
    examples: string;
    
    // 环境变量页面
    environmentVariablesAppliedToEverySession: string;
    addVariable: string;
    noEnvironmentVariablesConfigured: string;
    commonVariables: string;
    
    // 高级设置页面
    additionalConfigurationOptionsForAdvancedUsers: string;
    customScriptToGenerateAuthValues: string;
    rawSettingsJson: string;
    thisShowsTheRawJsonThatWillBeSaved: string;
    
    // CreateAgent 组件补充
    thisWillBeUsedAsDefaultTaskPlaceholder: string;
    sandboxPermissions: string;
    enableSandbox: string;
    runThisAgentInSecureSandboxEnvironment: string;
    fileReadAccess: string;
    allowReadingFilesAndDirectories: string;
    fileWriteAccess: string;
    allowCreatingAndModifyingFiles: string;
    networkAccess: string;
    allowOutboundNetworkConnections: string;
    defineTheBehaviorAndCapabilities: string;
    
    // Claude Code Session 界面
    claudeCodeSession: string;
    interactiveSession: string;
    openBrowserPreviewToTest: string;
    preview: string;
    pressEnterToSend: string;
    closePreview: string;
    closeThePreviewPane: string;
  }

const translations: Record<Language, Translations> = {
  en: {
    // 通用
    back: 'Back',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    
    // 欢迎页面
    welcomeToClaudia: 'Welcome to Claudia',
    ccAgents: 'CC Agents',
    ccProjects: 'CC Projects',
    
    // 导航和菜单
    usageDashboard: 'Usage Dashboard',
    claudeMd: 'CLAUDE.md',
    mcp: 'MCP',
    settings: 'Settings',
    
    // 使用情况仪表板
    trackUsageAndCosts: 'Track your Claude Code usage and costs',
    allTime: 'All Time',
    last30Days: 'Last 30 Days',
    last7Days: 'Last 7 Days',
    totalCost: 'Total Cost',
    totalSessions: 'Total Sessions',
    totalTokens: 'Total Tokens',
    avgCostPerSession: 'Avg Cost/Session',
    overview: 'Overview',
    byModel: 'By Model',
    byProject: 'By Project',
    bySession: 'By Session',
    timeline: 'Timeline',
    tokenBreakdown: 'Token Breakdown',
    inputTokens: 'Input Tokens',
    outputTokens: 'Output Tokens',
    cacheWrite: 'Cache Write',
    cacheRead: 'Cache Read',
    mostUsedModels: 'Most Used Models',
    topProjects: 'Top Projects',
    sessions: 'sessions',
    loadingUsageStats: 'Loading usage statistics...',
    tryAgain: 'Try Again',
    
    // 设置页面
    configureClaudeCodePreferences: 'Configure Claude Code preferences',
    saveSettings: 'Save Settings',
    general: 'General',
    permissions: 'Permissions',
    environment: 'Environment',
    advanced: 'Advanced',
    generalSettings: 'General Settings',
    includeCoAuthoredByClaude: 'Include "Co-authored by Claude"',
    addClaudeAttributionToGit: 'Add Claude attribution to git commits and pull requests',
    verboseOutput: 'Verbose Output',
    showFullBashAndCommandOutputs: 'Show full bash and command outputs',
    chatTranscriptRetentionDays: 'Chat Transcript Retention (days)',
    howLongToRetainChatTranscripts: 'How long to retain chat transcripts locally (default: 30 days)',
    claudeCodeInstallation: 'Claude Code Installation',
    selectWhichClaudeCodeInstallation: 'Select which Claude Code installation to use',
    
    // 项目页面
    browseYourClaudeCodeSessions: 'Browse your Claude Code sessions',
    backToHome: '← Back to Home',
    newClaudeCodeSession: 'New Claude Code session',
    noProjectsFound: 'No projects found in ~/.claude/projects',
    
    // 错误和状态
    failedToLoadProjects: 'Failed to load projects',
    failedToLoadSessions: 'Failed to load sessions',
    failedToCreateSession: 'Failed to create session',
    
    // CC Agents 页面
    ccAgentsTitle: 'CC Agents',
    createNewAgent: 'Create New Agent',
    importAgent: 'Import Agent',
    exportAgent: 'Export Agent',
    browseGitHubAgents: 'Browse GitHub Agents',
    viewRunningAgents: 'View Running Agents',
    agentRuns: 'Agent Runs',
    edit: 'Edit',
    delete: 'Delete',
    run: 'Run',
    export: 'Export',
    duplicate: 'Duplicate',
    created: 'Created',
    lastRun: 'Last Run',
    totalRuns: 'Total Runs',
    
    // 创建代理
    createAgent: 'Create Agent',
    agentName: 'Agent Name',
    agentDescription: 'Agent Description',
    agentInstructions: 'Agent Instructions',
    selectIcon: 'Select Icon',
    selectModel: 'Select Model',
    createAgentButton: 'Create Agent',
    
    // 通用操作
    create: 'Create',
    import: 'Import',
    browse: 'Browse',
    view: 'View',
    close: 'Close',
    refresh: 'Refresh',
    search: 'Search',
    filter: 'Filter',
    sort: 'Sort',
    clear: 'Clear',
    reset: 'Reset',
    apply: 'Apply',
    confirm: 'Confirm',
    
    // 状态和消息
    running: 'Running',
    stopped: 'Stopped',
    completed: 'Completed',
    failed: 'Failed',
    pending: 'Pending',
    noDataFound: 'No data found',
    loadingData: 'Loading data...',
    operationSuccessful: 'Operation successful',
    operationFailed: 'Operation failed',
    
    // 文件操作
    selectFile: 'Select File',
    selectFolder: 'Select Folder',
    uploadFile: 'Upload File',
    downloadFile: 'Download File',
    saveFile: 'Save File',
    openFile: 'Open File',
    
    // 时间和日期
    createdAt: 'Created At',
    updatedAt: 'Updated At',
    lastModified: 'Last Modified',
    duration: 'Duration',
    
    // 代理执行
    executeAgent: 'Execute Agent',
    executionLog: 'Execution Log',
    executionResult: 'Execution Result',
    selectProjectDirectory: 'Select Project Directory',
    
    // MCP 相关
    mcpServers: 'MCP Servers',
    addServer: 'Add Server',
    removeServer: 'Remove Server',
    serverStatus: 'Server Status',
    connected: 'Connected',
    disconnected: 'Disconnected',
    
    // 更多通用文本
    name: 'Name',
    description: 'Description',
    instructions: 'Instructions',
    basicInformation: 'Basic Information',
    systemPrompt: 'System Prompt',
    defaultTask: 'Default Task',
    optional: 'Optional',
    required: 'Required',
    enabled: 'Enabled',
    disabled: 'Disabled',
    
    // 代理相关
    editAgent: 'Edit Agent',
    updateAgent: 'Update Agent',
    agentNameRequired: 'Agent name is required',
    systemPromptRequired: 'System prompt is required',
    createNewCCAgent: 'Create a new Claude Code agent',
    updateCCAgent: 'Update your Claude Code agent',
    agentCreatedSuccessfully: 'Agent created successfully',
    agentUpdatedSuccessfully: 'Agent updated successfully',
    failedToCreateAgent: 'Failed to create agent',
    failedToUpdateAgent: 'Failed to update agent',
    unsavedChanges: 'You have unsaved changes. Are you sure you want to leave?',
    confirmLeave: 'Confirm Leave',
    saving: 'Saving...',
    
    // 执行相关
    executeAgentTitle: 'Execute Agent',
    projectDirectory: 'Project Directory',
    taskDescription: 'Task Description',
    selectProjectPath: 'Select Project Path',
    enterTaskDescription: 'Enter task description',
    startExecution: 'Start Execution',
    stopExecution: 'Stop Execution',
    executionOutput: 'Execution Output',
    executionStats: 'Execution Stats',
    elapsedTime: 'Elapsed Time',
    totalTokensUsed: 'Total Tokens Used',
    copyAsJsonl: 'Copy as JSONL',
    copyAsMarkdown: 'Copy as Markdown',
    fullscreenMode: 'Fullscreen Mode',
    exitFullscreen: 'Exit Fullscreen',
    
    // 错误边界
    errorOccurred: 'An error occurred while rendering this component.',
    errorDetails: 'Error details',
    tryAgainButton: 'Try Again',
    
    // MCP 管理
    manageMCPServers: 'Manage Model Context Protocol servers',
    mcpServerManagement: 'MCP Server Management',
    servers: 'Servers',
    addServerTab: 'Add Server',
    importExportTab: 'Import/Export',
    failedToLoadMCPServers: 'Failed to load MCP servers. Make sure Claude Code is installed.',
    mcpServerAddedSuccessfully: 'MCP server added successfully!',
    serverRemovedSuccessfully: 'Server removed successfully!',
    importedServersSuccessfully: 'Successfully imported servers!',
    
    // 文件选择
    selectPath: 'Select Path',
    chooseDirectory: 'Choose Directory',
    chooseFile: 'Choose File',
    
    // 确认对话框
    deleteConfirmation: 'Delete Confirmation',
    deleteAgentConfirmation: 'Are you sure you want to delete this agent?',
    areYouSure: 'Are you sure?',
    thisActionCannotBeUndone: 'This action cannot be undone.',
    
    // 分页
    page: 'Page',
    of: 'of',
    itemsPerPage: 'items per page',
    noItemsFound: 'No items found',
    
    // 模型选择
    claudeSonnet: 'Claude Sonnet',
    claudeOpus: 'Claude Opus',
    recommended: 'Recommended',
    
    // 权限设置
    allowRules: 'Allow Rules',
    denyRules: 'Deny Rules',
    addRule: 'Add Rule',
    removeRule: 'Remove Rule',
    
    // 环境变量
    environmentVariables: 'Environment Variables',
    addEnvironmentVariable: 'Add Environment Variable',
    removeEnvironmentVariable: 'Remove Environment Variable',
    key: 'Key',
    value: 'Value',
    
    // 高级设置
    advancedSettings: 'Advanced Settings',
    apiKeyHelper: 'API Key Helper',
    apiKeyHelperScript: 'API Key Helper Script',
    
    // 权限页面
    permissionRules: 'Permission Rules',
    controlWhichToolsClaudeCodeCanUse: 'Control which tools Claude Code can use without manual approval',
    noAllowRulesConfigured: 'No allow rules configured. Claude will ask for approval for all tools.',
    noDenyRulesConfigured: 'No deny rules configured.',
    examples: 'Examples:',
    
    // 环境变量页面
    environmentVariablesAppliedToEverySession: 'Environment variables applied to every Claude Code session',
    addVariable: 'Add Variable',
    noEnvironmentVariablesConfigured: 'No environment variables configured.',
    commonVariables: 'Common variables:',
    
    // 高级设置页面
    additionalConfigurationOptionsForAdvancedUsers: 'Additional configuration options for advanced users',
    customScriptToGenerateAuthValues: 'Custom script to generate auth values for API requests',
    rawSettingsJson: 'Raw Settings (JSON)',
    thisShowsTheRawJsonThatWillBeSaved: 'This shows the raw JSON that will be saved to ~/.claude/settings.json',
    
    // CreateAgent 组件补充
    thisWillBeUsedAsDefaultTaskPlaceholder: 'This will be used as the default task placeholder when executing the agent',
    sandboxPermissions: 'Sandbox Permissions',
    enableSandbox: 'Enable Sandbox',
    runThisAgentInSecureSandboxEnvironment: 'Run this agent in a secure sandbox environment',
    fileReadAccess: 'File Read Access',
    allowReadingFilesAndDirectories: 'Allow reading files and directories',
    fileWriteAccess: 'File Write Access',
    allowCreatingAndModifyingFiles: 'Allow creating and modifying files',
    networkAccess: 'Network Access',
    allowOutboundNetworkConnections: 'Allow outbound network connections',
    defineTheBehaviorAndCapabilities: 'Define the behavior and capabilities of your CC Agent',
    
    // Claude Code Session 界面
    claudeCodeSession: 'Claude Code Session',
    interactiveSession: 'Interactive session',
    openBrowserPreviewToTest: 'Open a browser preview to test your web applications',
    preview: 'Preview',
    pressEnterToSend: 'Press Enter to send, Shift+Enter for new line',
    closePreview: 'Close Preview',
    closeThePreviewPane: 'Close the preview pane',
  },
  
  zh: {
    // 通用
    back: '返回',
    save: '保存',
    cancel: '取消',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    
    // 欢迎页面
    welcomeToClaudia: '欢迎使用 Claudia',
    ccAgents: 'CC 代理',
    ccProjects: 'CC 项目',
    
    // 导航和菜单
    usageDashboard: '使用情况仪表板',
    claudeMd: 'CLAUDE.md',
    mcp: 'MCP',
    settings: '设置',
    
    // 使用情况仪表板
    trackUsageAndCosts: '追踪您的 Claude Code 使用情况和成本',
    allTime: '全部时间',
    last30Days: '最近 30 天',
    last7Days: '最近 7 天',
    totalCost: '总成本',
    totalSessions: '总会话数',
    totalTokens: '总令牌数',
    avgCostPerSession: '平均每会话成本',
    overview: '概览',
    byModel: '按模型',
    byProject: '按项目',
    bySession: '按会话',
    timeline: '时间线',
    tokenBreakdown: '令牌分解',
    inputTokens: '输入令牌',
    outputTokens: '输出令牌',
    cacheWrite: '缓存写入',
    cacheRead: '缓存读取',
    mostUsedModels: '最常用模型',
    topProjects: '热门项目',
    sessions: '会话',
    loadingUsageStats: '正在加载使用统计...',
    tryAgain: '重试',
    
    // 设置页面
    configureClaudeCodePreferences: '配置 Claude Code 偏好设置',
    saveSettings: '保存设置',
    general: '通用',
    permissions: '权限',
    environment: '环境',
    advanced: '高级',
    generalSettings: '通用设置',
    includeCoAuthoredByClaude: '包含 "Co-authored by Claude"',
    addClaudeAttributionToGit: '在 git 提交和拉取请求中添加 Claude 归属',
    verboseOutput: '详细输出',
    showFullBashAndCommandOutputs: '显示完整的 bash 和命令输出',
    chatTranscriptRetentionDays: '聊天记录保留天数',
    howLongToRetainChatTranscripts: '本地保留聊天记录的时长（默认：30 天）',
    claudeCodeInstallation: 'Claude Code 安装',
    selectWhichClaudeCodeInstallation: '选择要使用的 Claude Code 安装',
    
    // 项目页面
    browseYourClaudeCodeSessions: '浏览您的 Claude Code 会话',
    backToHome: '← 返回首页',
    newClaudeCodeSession: '新建 Claude Code 会话',
    noProjectsFound: '在 ~/.claude/projects 中未找到项目',
    
    // 错误和状态
    failedToLoadProjects: '加载项目失败',
    failedToLoadSessions: '加载会话失败',
    failedToCreateSession: '创建会话失败',
    
    // CC Agents 页面
    ccAgentsTitle: 'CC 代理',
    createNewAgent: '创建新代理',
    importAgent: '导入代理',
    exportAgent: '导出代理',
    browseGitHubAgents: '浏览 GitHub 代理',
    viewRunningAgents: '查看运行中的代理',
    agentRuns: '代理运行记录',
    edit: '编辑',
    delete: '删除',
    run: '运行',
    export: '导出',
    duplicate: '复制',
    created: '创建时间',
    lastRun: '上次运行',
    totalRuns: '总运行次数',
    
    // 创建代理
    createAgent: '创建代理',
    agentName: '代理名称',
    agentDescription: '代理描述',
    agentInstructions: '代理指令',
    selectIcon: '选择图标',
    selectModel: '选择模型',
    createAgentButton: '创建代理',
    
    // 通用操作
    create: '创建',
    import: '导入',
    browse: '浏览',
    view: '查看',
    close: '关闭',
    refresh: '刷新',
    search: '搜索',
    filter: '筛选',
    sort: '排序',
    clear: '清除',
    reset: '重置',
    apply: '应用',
    confirm: '确认',
    
    // 状态和消息
    running: '运行中',
    stopped: '已停止',
    completed: '已完成',
    failed: '失败',
    pending: '等待中',
    noDataFound: '未找到数据',
    loadingData: '正在加载数据...',
    operationSuccessful: '操作成功',
    operationFailed: '操作失败',
    
    // 文件操作
    selectFile: '选择文件',
    selectFolder: '选择文件夹',
    uploadFile: '上传文件',
    downloadFile: '下载文件',
    saveFile: '保存文件',
    openFile: '打开文件',
    
    // 时间和日期
    createdAt: '创建时间',
    updatedAt: '更新时间',
    lastModified: '最后修改',
    duration: '持续时间',
    
    // 代理执行
    executeAgent: '执行代理',
    executionLog: '执行日志',
    executionResult: '执行结果',
    selectProjectDirectory: '选择项目目录',
    
    // MCP 相关
    mcpServers: 'MCP 服务器',
    addServer: '添加服务器',
    removeServer: '移除服务器',
    serverStatus: '服务器状态',
    connected: '已连接',
    disconnected: '未连接',
    
    // 更多通用文本
    name: '名称',
    description: '描述',
    instructions: '指令',
    basicInformation: '基本信息',
    systemPrompt: '系统提示',
    defaultTask: '默认任务',
    optional: '可选',
    required: '必需',
    enabled: '已启用',
    disabled: '已禁用',
    
    // 代理相关
    editAgent: '编辑代理',
    updateAgent: '更新代理',
    agentNameRequired: '代理名称是必需的',
    systemPromptRequired: '系统提示是必需的',
    createNewCCAgent: '创建一个新的 Claude Code 代理',
    updateCCAgent: '更新您的 Claude Code 代理',
    agentCreatedSuccessfully: '代理创建成功',
    agentUpdatedSuccessfully: '代理更新成功',
    failedToCreateAgent: '创建代理失败',
    failedToUpdateAgent: '更新代理失败',
    unsavedChanges: '您有未保存的更改。确定要离开吗？',
    confirmLeave: '确认离开',
    saving: '正在保存...',
    
    // 执行相关
    executeAgentTitle: '执行代理',
    projectDirectory: '项目目录',
    taskDescription: '任务描述',
    selectProjectPath: '选择项目路径',
    enterTaskDescription: '输入任务描述',
    startExecution: '开始执行',
    stopExecution: '停止执行',
    executionOutput: '执行输出',
    executionStats: '执行统计',
    elapsedTime: '已用时间',
    totalTokensUsed: '已使用令牌总数',
    copyAsJsonl: '复制为 JSONL',
    copyAsMarkdown: '复制为 Markdown',
    fullscreenMode: '全屏模式',
    exitFullscreen: '退出全屏',
    
    // 错误边界
    errorOccurred: '渲染此组件时发生错误。',
    errorDetails: '错误详情',
    tryAgainButton: '重试',
    
    // MCP 管理
    manageMCPServers: '管理模型上下文协议服务器',
    mcpServerManagement: 'MCP 服务器管理',
    servers: '服务器',
    addServerTab: '添加服务器',
    importExportTab: '导入/导出',
    failedToLoadMCPServers: '加载 MCP 服务器失败。请确保已安装 Claude Code。',
    mcpServerAddedSuccessfully: 'MCP 服务器添加成功！',
    serverRemovedSuccessfully: '服务器移除成功！',
    importedServersSuccessfully: '服务器导入成功！',
    
    // 文件选择
    selectPath: '选择路径',
    chooseDirectory: '选择目录',
    chooseFile: '选择文件',
    
    // 确认对话框
    deleteConfirmation: '删除确认',
    deleteAgentConfirmation: '确定要删除此代理吗？',
    areYouSure: '您确定吗？',
    thisActionCannotBeUndone: '此操作无法撤销。',
    
    // 分页
    page: '页',
    of: '共',
    itemsPerPage: '项每页',
    noItemsFound: '未找到项目',
    
    // 模型选择
    claudeSonnet: 'Claude Sonnet',
    claudeOpus: 'Claude Opus',
    recommended: '推荐',
    
    // 权限设置
    allowRules: '允许规则',
    denyRules: '拒绝规则',
    addRule: '添加规则',
    removeRule: '移除规则',
    
    // 环境变量
    environmentVariables: '环境变量',
    addEnvironmentVariable: '添加环境变量',
    removeEnvironmentVariable: '移除环境变量',
    key: '键',
    value: '值',
    
    // 高级设置
    advancedSettings: '高级设置',
    apiKeyHelper: 'API 密钥助手',
    apiKeyHelperScript: 'API 密钥助手脚本',
    
    // 权限页面
    permissionRules: '权限规则',
    controlWhichToolsClaudeCodeCanUse: '控制 Claude Code 可以无需手动批准使用的工具',
    noAllowRulesConfigured: '未配置允许规则。Claude 将对所有工具请求批准。',
    noDenyRulesConfigured: '未配置拒绝规则。',
    examples: '示例：',
    
    // 环境变量页面
    environmentVariablesAppliedToEverySession: '应用于每个 Claude Code 会话的环境变量',
    addVariable: '添加变量',
    noEnvironmentVariablesConfigured: '未配置环境变量。',
    commonVariables: '常用变量：',
    
    // 高级设置页面
    additionalConfigurationOptionsForAdvancedUsers: '为高级用户提供的额外配置选项',
    customScriptToGenerateAuthValues: '用于生成 API 请求身份验证值的自定义脚本',
    rawSettingsJson: '原始设置 (JSON)',
    thisShowsTheRawJsonThatWillBeSaved: '这显示了将保存到 ~/.claude/settings.json 的原始 JSON',
    
    // CreateAgent 组件补充
    thisWillBeUsedAsDefaultTaskPlaceholder: '这将在执行代理时用作默认任务占位符',
    sandboxPermissions: '沙盒权限',
    enableSandbox: '启用沙盒',
    runThisAgentInSecureSandboxEnvironment: '在安全沙盒环境中运行此代理',
    fileReadAccess: '文件读取权限',
    allowReadingFilesAndDirectories: '允许读取文件和目录',
    fileWriteAccess: '文件写入权限',
    allowCreatingAndModifyingFiles: '允许创建和修改文件',
    networkAccess: '网络访问',
    allowOutboundNetworkConnections: '允许出站网络连接',
    defineTheBehaviorAndCapabilities: '定义您的 CC 代理的行为和功能',
    
    // Claude Code Session 界面
    claudeCodeSession: 'Claude Code 会话',
    interactiveSession: '交互式会话',
    openBrowserPreviewToTest: '打开浏览器预览以测试您的 Web 应用程序',
    preview: '预览',
    pressEnterToSend: '按 Enter 发送，Shift+Enter 换行',
    closePreview: '关闭预览',
    closeThePreviewPane: '关闭预览面板',
  }
};

// 当前语言状态
let currentLanguage: Language = 'zh'; // 默认设置为中文

// 获取当前语言
export const getCurrentLanguage = (): Language => currentLanguage;

// 设置语言
export const setLanguage = (lang: Language): void => {
  currentLanguage = lang;
  // 触发重新渲染
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: lang }));
};

// 获取翻译文本
export const t = (key: keyof Translations): string => {
  return translations[currentLanguage][key] || translations.en[key] || key;
};

// 获取所有翻译
export const getTranslations = (): Translations => {
  return translations[currentLanguage];
};

// 支持的语言列表
export const supportedLanguages: Array<{ code: Language; name: string; nativeName: string }> = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' }
]; 