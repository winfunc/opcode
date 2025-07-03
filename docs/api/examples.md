# Code Examples and Usage Patterns

This document provides practical examples and common usage patterns for working with the Claudia API. These examples demonstrate real-world scenarios and best practices.

## Table of Contents
- [Quick Start Examples](#quick-start-examples)
- [Project Workflows](#project-workflows)
- [Agent Development Patterns](#agent-development-patterns)
- [Session Management Examples](#session-management-examples)
- [MCP Integration Examples](#mcp-integration-examples)
- [Analytics and Monitoring](#analytics-and-monitoring)
- [Advanced Patterns](#advanced-patterns)
- [Complete Applications](#complete-applications)

## Quick Start Examples

### Basic Project Setup

```typescript
import { api } from '@/lib/api';

// Quick project setup and first session
async function quickStart() {
  console.log('🚀 Claudia Quick Start');
  
  // 1. Check Claude installation
  const version = await api.checkClaudeVersion();
  if (!version.is_installed) {
    throw new Error('Claude Code not found. Please install from https://claude.ai/code');
  }
  console.log(`✅ Claude Code ${version.version} found`);
  
  // 2. List existing projects
  const projects = await api.listProjects();
  console.log(`📁 Found ${projects.length} existing projects`);
  
  // 3. Create first agent
  const codeHelper = await api.createAgent(
    'Code Helper',
    'bot',
    'You are a helpful coding assistant. Provide clear, concise code examples and explanations.',
    'Help with coding questions and provide examples',
    'sonnet'
  );
  console.log(`🤖 Created agent: ${codeHelper.name} (ID: ${codeHelper.id})`);
  
  // 4. Start a session
  const projectPath = '/path/to/your/project';
  await api.executeClaudeCode(
    projectPath,
    'Help me understand the project structure and suggest improvements',
    'sonnet'
  );
  console.log('💬 Session started!');
  
  return { agent: codeHelper, projectPath };
}
```

### Simple Agent Execution

```typescript
// Execute an agent and monitor results
async function runAgentExample() {
  const agents = await api.listAgents();
  const codeReviewer = agents.find(a => a.name.includes('Code Reviewer'));
  
  if (!codeReviewer) {
    console.log('No code reviewer agent found');
    return;
  }
  
  // Execute agent
  const runId = await api.executeAgent(
    codeReviewer.id!,
    '/path/to/project',
    'Review this codebase for potential security issues'
  );
  
  console.log(`🚀 Agent started: Run ID ${runId}`);
  
  // Monitor execution
  let isRunning = true;
  while (isRunning) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const run = await api.getAgentRunWithRealTimeMetrics(runId);
    console.log(`Status: ${run.status}`);
    
    if (run.metrics) {
      console.log(`Tokens: ${run.metrics.total_tokens}, Cost: $${run.metrics.cost_usd?.toFixed(4)}`);
    }
    
    if (run.status !== 'running' && run.status !== 'pending') {
      isRunning = false;
      console.log(`✅ Agent completed with status: ${run.status}`);
    }
  }
}
```

## Project Workflows

### Project Initialization Workflow

```typescript
class ProjectInitializer {
  async initializeProject(projectPath: string, projectType: 'web' | 'api' | 'mobile' | 'data'): Promise<void> {
    console.log(`🎯 Initializing ${projectType} project: ${projectPath}`);
    
    // 1. Validate project directory
    try {
      await api.listDirectoryContents(projectPath);
    } catch (error) {
      throw new Error(`Project directory not accessible: ${projectPath}`);
    }
    
    // 2. Create project-specific CLAUDE.md
    const systemPrompt = this.getSystemPromptForProjectType(projectType, projectPath);
    await api.saveClaudeMdFile(`${projectPath}/CLAUDE.md`, systemPrompt);
    console.log('📝 Created CLAUDE.md system prompt');
    
    // 3. Set up MCP servers for project type
    await this.setupMCPServers(projectPath, projectType);
    
    // 4. Create specialized agents
    const agents = await this.createProjectAgents(projectType);
    console.log(`🤖 Created ${agents.length} specialized agents`);
    
    // 5. Initial project analysis session
    await api.executeClaudeCode(
      projectPath,
      `Analyze this ${projectType} project structure and provide recommendations for:
      - Code organization
      - Best practices implementation
      - Potential improvements
      - Development workflow optimization`,
      'sonnet'
    );
    
    console.log('✅ Project initialization complete!');
  }
  
  private getSystemPromptForProjectType(type: string, projectPath: string): string {
    const basePrompt = `# ${type.toUpperCase()} Project Assistant

You are a specialized assistant for this ${type} project located at: ${projectPath}

## Your Expertise:
`;
    
    const typeSpecificPrompts = {
      web: `
- Frontend frameworks (React, Vue, Angular)
- Modern CSS and styling solutions
- Web performance optimization
- Accessibility best practices
- SEO optimization
- Browser compatibility`,
      
      api: `
- RESTful API design
- Database optimization
- Authentication and authorization
- API security best practices
- Documentation generation
- Testing strategies`,
      
      mobile: `
- Mobile app development (React Native, Flutter, native)
- Platform-specific guidelines
- App store optimization
- Performance on mobile devices
- Offline functionality
- Push notifications`,
      
      data: `
- Data processing and analysis
- Database design and optimization
- ETL pipelines
- Data visualization
- Statistical analysis
- Machine learning integration`
    };
    
    return basePrompt + (typeSpecificPrompts[type] || 'General software development');
  }
  
  private async setupMCPServers(projectPath: string, projectType: string): Promise<void> {
    const serverConfigs = {
      web: [
        { name: 'npm-manager', command: 'node', args: ['./mcp-servers/npm.js'] },
        { name: 'bundler-analyzer', command: 'node', args: ['./mcp-servers/webpack.js'] }
      ],
      api: [
        { name: 'database-manager', command: 'python', args: ['-m', 'mcp_db_server'] },
        { name: 'api-tester', command: 'node', args: ['./mcp-servers/api-test.js'] }
      ],
      mobile: [
        { name: 'device-simulator', command: 'node', args: ['./mcp-servers/device.js'] }
      ],
      data: [
        { name: 'data-processor', command: 'python', args: ['-m', 'mcp_data_server'] }
      ]
    };
    
    const servers = serverConfigs[projectType] || [];
    
    for (const server of servers) {
      try {
        await api.mcpAdd(
          server.name,
          'stdio',
          server.command,
          server.args,
          { PROJECT_ROOT: projectPath },
          undefined,
          'project'
        );
        console.log(`✅ Added MCP server: ${server.name}`);
      } catch (error) {
        console.warn(`⚠️ Failed to add MCP server ${server.name}: ${error.message}`);
      }
    }
  }
  
  private async createProjectAgents(projectType: string): Promise<Agent[]> {
    const agentConfigs = [
      {
        name: `${projectType.toUpperCase()} Code Reviewer`,
        icon: 'shield',
        prompt: `You are a ${projectType} development expert. Review code for:
        - Best practices specific to ${projectType} development
        - Security vulnerabilities
        - Performance optimizations
        - Code maintainability and readability`,
        task: `Review the ${projectType} codebase for best practices and potential issues`,
        model: 'sonnet'
      },
      {
        name: `${projectType.toUpperCase()} Test Generator`,
        icon: 'terminal',
        prompt: `You are a testing expert for ${projectType} projects. Generate comprehensive tests:
        - Unit tests for core functionality
        - Integration tests for ${projectType}-specific features
        - End-to-end tests for user workflows
        - Performance and load tests where applicable`,
        task: `Generate comprehensive test suite for this ${projectType} project`,
        model: 'sonnet'
      },
      {
        name: `${projectType.toUpperCase()} Documentation Bot`,
        icon: 'file-text',
        prompt: `You are a technical writer specializing in ${projectType} projects. Create:
        - Clear API documentation
        - User guides and tutorials
        - Code comments and inline documentation
        - Architecture and design documentation`,
        task: `Create comprehensive documentation for this ${projectType} project`,
        model: 'haiku'
      }
    ];
    
    const agents: Agent[] = [];
    
    for (const config of agentConfigs) {
      try {
        const agent = await api.createAgent(
          config.name,
          config.icon,
          config.prompt,
          config.task,
          config.model
        );
        agents.push(agent);
      } catch (error) {
        console.warn(`Failed to create agent ${config.name}: ${error.message}`);
      }
    }
    
    return agents;
  }
}

// Usage
const initializer = new ProjectInitializer();
await initializer.initializeProject('/path/to/my/web/app', 'web');
```

### Multi-Project Management

```typescript
class ProjectManager {
  async manageDailyWorkflow(): Promise<void> {
    console.log('🌅 Starting daily development workflow');
    
    // 1. Get all projects and their recent activity
    const projects = await api.listProjects();
    const projectActivity = await Promise.all(
      projects.map(async project => {
        const sessions = await api.getProjectSessions(project.id);
        const recentSessions = sessions.filter(session => {
          const sessionDate = new Date(session.created_at * 1000);
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          return sessionDate > yesterday;
        });
        
        return {
          project,
          recentActivity: recentSessions.length,
          lastSession: sessions[sessions.length - 1]
        };
      })
    );
    
    // 2. Prioritize projects by recent activity
    const activeProjects = projectActivity
      .filter(p => p.recentActivity > 0)
      .sort((a, b) => b.recentActivity - a.recentActivity);
    
    console.log('📈 Active projects today:');
    activeProjects.forEach(({ project, recentActivity, lastSession }) => {
      console.log(`  📁 ${project.path}: ${recentActivity} sessions`);
      if (lastSession?.first_message) {
        console.log(`     Last: "${lastSession.first_message.slice(0, 60)}..."`);
      }
    });
    
    // 3. Run daily maintenance on active projects
    for (const { project } of activeProjects.slice(0, 3)) { // Top 3 active projects
      await this.runDailyMaintenance(project);
    }
  }
  
  private async runDailyMaintenance(project: Project): Promise<void> {
    console.log(`🔧 Running maintenance for ${project.path}`);
    
    try {
      // Create daily checkpoint
      const sessions = await api.getProjectSessions(project.id);
      if (sessions.length > 0) {
        const latestSession = sessions[sessions.length - 1];
        await api.createCheckpoint(
          latestSession.id,
          project.id,
          project.path,
          undefined,
          `Daily checkpoint - ${new Date().toDateString()}`
        );
        console.log(`  ✅ Created daily checkpoint`);
      }
      
      // Run code quality check
      const agents = await api.listAgents();
      const qualityAgent = agents.find(a => a.name.includes('Code Reviewer'));
      
      if (qualityAgent) {
        await api.executeAgent(
          qualityAgent.id!,
          project.path,
          'Perform daily code quality check and identify any new issues'
        );
        console.log(`  ✅ Started code quality check`);
      }
      
      // Update project documentation if needed
      const claudeFiles = await api.findClaudeMdFiles(project.path);
      if (claudeFiles.length === 0) {
        console.log(`  ⚠️ No CLAUDE.md found - consider adding project context`);
      }
      
    } catch (error) {
      console.warn(`  ❌ Maintenance failed for ${project.path}: ${error.message}`);
    }
  }
  
  async generateWeeklyReport(): Promise<void> {
    console.log('📊 Generating weekly development report');
    
    // Get usage stats for the week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const weeklyStats = await api.getUsageByDateRange(
      weekAgo.toISOString().split('T')[0],
      new Date().toISOString().split('T')[0]
    );
    
    // Get project stats
    const projectStats = await api.getSessionStats(
      weekAgo.toISOString().slice(0, 10).replace(/-/g, ''),
      new Date().toISOString().slice(0, 10).replace(/-/g, ''),
      'desc'
    );
    
    console.log('\n📈 Weekly Development Report');
    console.log('=' .repeat(50));
    console.log(`💰 Total Cost: $${weeklyStats.total_cost.toFixed(4)}`);
    console.log(`🔢 Total Tokens: ${weeklyStats.total_tokens.toLocaleString()}`);
    console.log(`📝 Total Sessions: ${weeklyStats.total_sessions}`);
    
    console.log('\n🏆 Most Active Projects:');
    projectStats.slice(0, 5).forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.project_name}`);
      console.log(`     Sessions: ${project.session_count}, Cost: $${project.total_cost.toFixed(4)}`);
    });
    
    console.log('\n🤖 Model Usage:');
    weeklyStats.by_model.forEach(model => {
      const percentage = (model.total_cost / weeklyStats.total_cost * 100).toFixed(1);
      console.log(`  ${model.model}: ${percentage}% ($${model.total_cost.toFixed(4)})`);
    });
    
    console.log('\n📅 Daily Breakdown:');
    weeklyStats.by_date.forEach(day => {
      console.log(`  ${day.date}: $${day.total_cost.toFixed(4)} (${day.total_tokens.toLocaleString()} tokens)`);
    });
  }
}
```

## Agent Development Patterns

### Agent Factory Pattern

```typescript
class AgentFactory {
  static async createSpecializedTeam(specialty: string): Promise<Agent[]> {
    const team: Agent[] = [];
    
    switch (specialty) {
      case 'security':
        team.push(...await this.createSecurityTeam());
        break;
      case 'testing':
        team.push(...await this.createTestingTeam());
        break;
      case 'devops':
        team.push(...await this.createDevOpsTeam());
        break;
      case 'frontend':
        team.push(...await this.createFrontendTeam());
        break;
      case 'backend':
        team.push(...await this.createBackendTeam());
        break;
      default:
        team.push(...await this.createGeneralTeam());
    }
    
    return team;
  }
  
  private static async createSecurityTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'Security Vulnerability Scanner',
        'shield',
        `You are a cybersecurity expert specializing in vulnerability assessment. 

Your expertise includes:
- OWASP Top 10 vulnerabilities
- Static code analysis for security flaws
- Dependency vulnerability scanning
- Authentication and authorization issues
- Data protection and privacy compliance
- Secure coding practices

Always provide:
- Specific vulnerability details with CVE references when applicable
- Risk assessment (Critical/High/Medium/Low)
- Concrete remediation steps
- Code examples for fixes`,
        'Scan codebase for security vulnerabilities and provide detailed remediation guidance',
        'opus'
      ),
      
      api.createAgent(
        'Penetration Testing Assistant',
        'shield',
        `You are a penetration testing specialist focused on application security testing.

Your specializations:
- Web application penetration testing
- API security testing
- Input validation testing
- Business logic flaw identification
- Session management testing
- Cross-site scripting (XSS) detection

Provide detailed testing scenarios and exploitation examples.`,
        'Design and execute penetration testing scenarios for the application',
        'sonnet'
      ),
      
      api.createAgent(
        'Compliance Auditor',
        'shield',
        `You are a compliance specialist ensuring adherence to security standards.

Standards expertise:
- SOC 2 Type II compliance
- PCI DSS requirements
- GDPR data protection
- HIPAA for healthcare data
- ISO 27001 security management
- Industry-specific regulations

Focus on gap analysis and compliance roadmaps.`,
        'Audit codebase for compliance with relevant security standards',
        'sonnet'
      )
    ]);
  }
  
  private static async createTestingTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'Unit Test Generator',
        'terminal',
        `You are a testing expert specializing in comprehensive unit test generation.

Your approach:
- Achieve >90% code coverage
- Test edge cases and error conditions
- Use appropriate mocking strategies
- Follow testing framework best practices
- Generate readable and maintainable tests
- Include performance benchmarks where relevant

Always provide complete, runnable test suites.`,
        'Generate comprehensive unit tests with high coverage and edge case handling',
        'sonnet'
      ),
      
      api.createAgent(
        'Integration Test Architect',
        'terminal',
        `You are an integration testing specialist designing end-to-end test scenarios.

Your expertise:
- API integration testing
- Database integration testing
- Third-party service integration
- Contract testing strategies
- Test environment management
- CI/CD pipeline integration

Focus on realistic test scenarios and data management.`,
        'Design and implement integration test suites for all system components',
        'sonnet'
      ),
      
      api.createAgent(
        'Performance Test Engineer',
        'terminal',
        `You are a performance testing specialist focusing on system optimization.

Your capabilities:
- Load testing strategy design
- Stress testing scenarios
- Performance bottleneck identification
- Scalability analysis
- Resource utilization optimization
- Performance monitoring setup

Provide detailed performance test plans and optimization recommendations.`,
        'Create performance testing strategy and identify optimization opportunities',
        'opus'
      )
    ]);
  }
  
  private static async createDevOpsTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'Infrastructure as Code Specialist',
        'terminal',
        `You are a DevOps engineer specializing in Infrastructure as Code (IaC).

Your expertise:
- Terraform and CloudFormation
- Kubernetes and Docker containerization
- CI/CD pipeline optimization
- Cloud architecture (AWS, Azure, GCP)
- Infrastructure monitoring and alerting
- Cost optimization strategies

Provide production-ready IaC templates and deployment strategies.`,
        'Design and implement infrastructure as code for scalable deployment',
        'sonnet'
      ),
      
      api.createAgent(
        'CI/CD Pipeline Engineer',
        'git-branch',
        `You are a CI/CD specialist focused on automated deployment pipelines.

Your focus areas:
- GitHub Actions, GitLab CI, Jenkins
- Automated testing integration
- Security scanning in pipelines
- Deployment strategies (blue-green, canary)
- Environment management
- Rollback and recovery procedures

Create robust, secure, and efficient deployment pipelines.`,
        'Design and implement comprehensive CI/CD pipelines with security and quality gates',
        'sonnet'
      )
    ]);
  }
  
  private static async createFrontendTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'React/Vue Specialist',
        'code',
        `You are a frontend development expert specializing in modern JavaScript frameworks.

Your expertise:
- React, Vue, Angular best practices
- State management (Redux, Vuex, Pinia)
- Component architecture and design patterns
- Performance optimization techniques
- Accessibility (WCAG compliance)
- Modern CSS and styling solutions

Provide production-quality component implementations.`,
        'Review and optimize frontend architecture and component implementation',
        'sonnet'
      ),
      
      api.createAgent(
        'UI/UX Optimizer',
        'code',
        `You are a UI/UX specialist focused on user experience optimization.

Your specializations:
- User interface design principles
- Responsive design implementation
- Performance optimization for UX
- Accessibility best practices
- Cross-browser compatibility
- Mobile-first design approaches

Focus on practical improvements that enhance user experience.`,
        'Analyze and improve user interface design and user experience',
        'sonnet'
      )
    ]);
  }
  
  private static async createBackendTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'API Design Architect',
        'database',
        `You are a backend architecture specialist focusing on API design and data management.

Your expertise:
- RESTful API design principles
- GraphQL schema design
- Database design and optimization
- Microservices architecture
- Event-driven architecture
- API security and authentication

Provide scalable, maintainable backend solutions.`,
        'Design and review backend architecture, APIs, and data models',
        'opus'
      ),
      
      api.createAgent(
        'Database Optimization Specialist',
        'database',
        `You are a database expert specializing in performance optimization and design.

Your focus areas:
- Query optimization and indexing
- Database schema design
- Performance monitoring and tuning
- Data migration strategies
- Backup and recovery procedures
- Scaling strategies (sharding, replication)

Provide detailed optimization recommendations with measurable improvements.`,
        'Optimize database performance, design, and scalability',
        'sonnet'
      )
    ]);
  }
  
  private static async createGeneralTeam(): Promise<Agent[]> {
    return Promise.all([
      api.createAgent(
        'Code Review Assistant',
        'code',
        `You are a senior software engineer providing comprehensive code reviews.

Your review focus:
- Code quality and maintainability
- Design patterns and architecture
- Performance considerations
- Security best practices
- Documentation quality
- Test coverage assessment

Provide constructive feedback with specific improvement suggestions.`,
        'Perform comprehensive code review with actionable feedback',
        'sonnet'
      ),
      
      api.createAgent(
        'Documentation Generator',
        'file-text',
        `You are a technical writer specializing in software documentation.

Your documentation expertise:
- API documentation generation
- Code comment enhancement
- User guide creation
- Architecture documentation
- README file optimization
- Knowledge base articles

Create clear, comprehensive, and maintainable documentation.`,
        'Generate comprehensive project documentation including APIs, guides, and comments',
        'haiku'
      )
    ]);
  }
}

// Usage examples
const securityTeam = await AgentFactory.createSpecializedTeam('security');
console.log(`Created security team with ${securityTeam.length} agents`);

const testingTeam = await AgentFactory.createSpecializedTeam('testing');
console.log(`Created testing team with ${testingTeam.length} agents`);
```

### Agent Orchestration Pattern

```typescript
class AgentOrchestrator {
  private runningAgents = new Map<number, { agent: Agent; runId: number; startTime: Date }>();
  
  async orchestrateCodeReview(projectPath: string): Promise<CodeReviewReport> {
    console.log('🎭 Orchestrating comprehensive code review');
    
    // Get specialized agents
    const agents = await api.listAgents();
    const reviewAgents = {
      security: agents.find(a => a.name.includes('Security')),
      quality: agents.find(a => a.name.includes('Code Review')),
      performance: agents.find(a => a.name.includes('Performance')),
      testing: agents.find(a => a.name.includes('Test'))
    };
    
    // Start all agents in parallel
    const agentPromises = Object.entries(reviewAgents)
      .filter(([_, agent]) => agent !== undefined)
      .map(async ([type, agent]) => {
        const task = this.getTaskForReviewType(type);
        const runId = await api.executeAgent(agent!.id!, projectPath, task);
        
        this.runningAgents.set(runId, {
          agent: agent!,
          runId,
          startTime: new Date()
        });
        
        return { type, runId, agent: agent! };
      });
    
    const startedAgents = await Promise.all(agentPromises);
    console.log(`🚀 Started ${startedAgents.length} review agents`);
    
    // Monitor and collect results
    const results = await this.collectAgentResults(startedAgents);
    
    // Generate consolidated report
    return this.generateConsolidatedReport(results, projectPath);
  }
  
  private getTaskForReviewType(type: string): string {
    const tasks = {
      security: 'Perform comprehensive security vulnerability assessment focusing on OWASP Top 10 and secure coding practices',
      quality: 'Review code quality, maintainability, design patterns, and architectural decisions',
      performance: 'Analyze performance bottlenecks, optimization opportunities, and scalability issues',
      testing: 'Evaluate test coverage, test quality, and recommend additional testing strategies'
    };
    
    return tasks[type] || 'Perform general code review';
  }
  
  private async collectAgentResults(
    startedAgents: Array<{ type: string; runId: number; agent: Agent }>
  ): Promise<Array<{ type: string; agent: Agent; result: AgentRunWithMetrics }>> {
    const results: Array<{ type: string; agent: Agent; result: AgentRunWithMetrics }> = [];
    const pendingAgents = new Set(startedAgents.map(a => a.runId));
    
    while (pendingAgents.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      
      for (const runId of pendingAgents) {
        try {
          const run = await api.getAgentRunWithRealTimeMetrics(runId);
          
          if (run.status === 'completed' || run.status === 'failed') {
            const agentInfo = startedAgents.find(a => a.runId === runId)!;
            results.push({ 
              type: agentInfo.type, 
              agent: agentInfo.agent, 
              result: run 
            });
            
            pendingAgents.delete(runId);
            this.runningAgents.delete(runId);
            
            console.log(`✅ ${agentInfo.type} review completed (${run.status})`);
          } else {
            // Show progress
            const agentInfo = this.runningAgents.get(runId);
            if (agentInfo && run.metrics) {
              const elapsed = Date.now() - agentInfo.startTime.getTime();
              console.log(`⏳ ${agentInfo.agent.name}: ${Math.round(elapsed/1000)}s, ${run.metrics.total_tokens} tokens`);
            }
          }
        } catch (error) {
          console.warn(`Error checking agent ${runId}: ${error.message}`);
        }
      }
    }
    
    return results;
  }
  
  private async generateConsolidatedReport(
    results: Array<{ type: string; agent: Agent; result: AgentRunWithMetrics }>,
    projectPath: string
  ): Promise<CodeReviewReport> {
    const report: CodeReviewReport = {
      projectPath,
      timestamp: new Date().toISOString(),
      summary: {
        totalAgents: results.length,
        completedSuccessfully: results.filter(r => r.result.status === 'completed').length,
        totalCost: results.reduce((sum, r) => sum + (r.result.metrics?.cost_usd || 0), 0),
        totalTokens: results.reduce((sum, r) => sum + (r.result.metrics?.total_tokens || 0), 0)
      },
      findings: {},
      recommendations: [],
      metrics: {}
    };
    
    // Process results by type
    for (const { type, agent, result } of results) {
      if (result.status === 'completed' && result.output) {
        const findings = this.extractFindings(result.output);
        report.findings[type] = {
          agent: agent.name,
          status: result.status,
          findings,
          metrics: result.metrics
        };
        
        // Extract recommendations
        const recommendations = this.extractRecommendations(result.output);
        report.recommendations.push(...recommendations.map(rec => ({
          type,
          recommendation: rec,
          priority: this.determinePriority(rec, type)
        })));
      }
    }
    
    // Generate executive summary
    report.executiveSummary = this.generateExecutiveSummary(report);
    
    return report;
  }
  
  private extractFindings(output: string): string[] {
    const findings: string[] = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        if (message.role === 'assistant' && message.content) {
          // Extract bullet points, numbered lists, or key findings
          const content = message.content;
          const issuePatterns = [
            /- (.*(?:vulnerability|issue|problem|concern|risk).*)/gi,
            /\d+\. (.*(?:vulnerability|issue|problem|concern|risk).*)/gi,
            /⚠️ (.*)/gi,
            /❌ (.*)/gi,
            /🚨 (.*)/gi
          ];
          
          for (const pattern of issuePatterns) {
            const matches = content.match(pattern);
            if (matches) {
              findings.push(...matches);
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    return findings;
  }
  
  private extractRecommendations(output: string): string[] {
    const recommendations: string[] = [];
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const message = JSON.parse(line);
        if (message.role === 'assistant' && message.content) {
          const content = message.content;
          const recPatterns = [
            /- (.*(?:recommend|suggest|should|consider|improve).*)/gi,
            /\d+\. (.*(?:recommend|suggest|should|consider|improve).*)/gi,
            /✅ (.*)/gi,
            /💡 (.*)/gi
          ];
          
          for (const pattern of recPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              recommendations.push(...matches);
            }
          }
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
    
    return recommendations;
  }
  
  private determinePriority(recommendation: string, type: string): 'high' | 'medium' | 'low' {
    const highPriorityKeywords = ['critical', 'security', 'vulnerability', 'urgent', 'immediately'];
    const lowPriorityKeywords = ['consider', 'suggestion', 'optional', 'future', 'enhancement'];
    
    const lowerRec = recommendation.toLowerCase();
    
    if (type === 'security' || highPriorityKeywords.some(kw => lowerRec.includes(kw))) {
      return 'high';
    }
    
    if (lowPriorityKeywords.some(kw => lowerRec.includes(kw))) {
      return 'low';
    }
    
    return 'medium';
  }
  
  private generateExecutiveSummary(report: CodeReviewReport): string {
    const totalFindings = Object.values(report.findings).reduce(
      (sum, finding) => sum + finding.findings.length, 0
    );
    
    const highPriorityRecs = report.recommendations.filter(r => r.priority === 'high').length;
    
    return `Code review completed for ${report.projectPath}:
    
📊 Summary:
- ${report.summary.completedSuccessfully}/${report.summary.totalAgents} agents completed successfully
- ${totalFindings} total findings identified
- ${report.recommendations.length} recommendations generated
- ${highPriorityRecs} high-priority items requiring attention

💰 Cost: $${report.summary.totalCost.toFixed(4)}
🔢 Tokens: ${report.summary.totalTokens.toLocaleString()}

🎯 Next Steps:
1. Address high-priority security and performance issues
2. Implement recommended testing improvements
3. Apply code quality enhancements
4. Schedule follow-up review in 2 weeks`;
  }
}

// Supporting types
interface CodeReviewReport {
  projectPath: string;
  timestamp: string;
  summary: {
    totalAgents: number;
    completedSuccessfully: number;
    totalCost: number;
    totalTokens: number;
  };
  findings: Record<string, {
    agent: string;
    status: string;
    findings: string[];
    metrics?: AgentRunMetrics;
  }>;
  recommendations: Array<{
    type: string;
    recommendation: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  metrics: Record<string, any>;
  executiveSummary?: string;
}

// Usage
const orchestrator = new AgentOrchestrator();
const report = await orchestrator.orchestrateCodeReview('/path/to/project');
console.log(report.executiveSummary);
```

## Session Management Examples

### Session State Management

```typescript
class SessionStateManager {
  private activeSessions = new Map<string, SessionState>();
  
  async createManagedSession(
    projectPath: string,
    initialPrompt: string,
    options: SessionOptions = {}
  ): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Set up session state
    const sessionState: SessionState = {
      sessionId,
      projectPath,
      status: 'initializing',
      startTime: new Date(),
      checkpointStrategy: options.checkpointStrategy || 'smart',
      autoSave: options.autoSave !== false,
      maxTokens: options.maxTokens || 100000,
      currentTokens: 0,
      messageCount: 0,
      lastActivity: new Date()
    };
    
    this.activeSessions.set(sessionId, sessionState);
    
    try {
      // Start the Claude session
      await api.executeClaudeCode(projectPath, initialPrompt, options.model || 'sonnet');
      
      sessionState.status = 'running';
      
      // Set up automatic checkpoint creation
      if (sessionState.checkpointStrategy !== 'manual') {
        await this.setupAutoCheckpointing(sessionState);
      }
      
      // Set up session monitoring
      this.startSessionMonitoring(sessionState);
      
      console.log(`✅ Managed session created: ${sessionId}`);
      return sessionId;
      
    } catch (error) {
      sessionState.status = 'failed';
      throw new Error(`Failed to create managed session: ${error.message}`);
    }
  }
  
  async continueSession(
    sessionId: string,
    prompt: string,
    options: { createCheckpoint?: boolean } = {}
  ): Promise<void> {
    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Create checkpoint before continuing if requested
    if (options.createCheckpoint) {
      await this.createSessionCheckpoint(sessionState, 'Manual checkpoint before continuation');
    }
    
    // Check token limits
    if (sessionState.currentTokens > sessionState.maxTokens) {
      throw new Error(`Session ${sessionId} has exceeded token limit (${sessionState.maxTokens})`);
    }
    
    try {
      await api.continueClaudeCode(sessionState.projectPath, prompt, 'sonnet');
      
      sessionState.messageCount++;
      sessionState.lastActivity = new Date();
      
      console.log(`💬 Session ${sessionId} continued (message ${sessionState.messageCount})`);
      
    } catch (error) {
      sessionState.status = 'error';
      throw new Error(`Failed to continue session: ${error.message}`);
    }
  }
  
  private async setupAutoCheckpointing(sessionState: SessionState): Promise<void> {
    const projects = await api.listProjects();
    const project = projects.find(p => p.path === sessionState.projectPath);
    
    if (!project) {
      console.warn(`Project not found for auto-checkpointing: ${sessionState.projectPath}`);
      return;
    }
    
    // Configure checkpoint settings
    await api.updateCheckpointSettings(
      sessionState.sessionId,
      project.id,
      sessionState.projectPath,
      true,
      sessionState.checkpointStrategy
    );
    
    console.log(`🤖 Auto-checkpointing enabled for session ${sessionState.sessionId}`);
  }
  
  private async createSessionCheckpoint(sessionState: SessionState, description: string): Promise<void> {
    try {
      const projects = await api.listProjects();
      const project = projects.find(p => p.path === sessionState.projectPath);
      
      if (project) {
        const result = await api.createCheckpoint(
          sessionState.sessionId,
          project.id,
          sessionState.projectPath,
          sessionState.messageCount,
          description
        );
        
        console.log(`📍 Checkpoint created: ${result.checkpoint.id.slice(0, 8)}`);
      }
    } catch (error) {
      console.warn(`Failed to create checkpoint: ${error.message}`);
    }
  }
  
  private startSessionMonitoring(sessionState: SessionState): void {
    const monitoringInterval = setInterval(async () => {
      try {
        // Check if session is still active
        const runningSessions = await api.listRunningClaudeSessions();
        const isRunning = runningSessions.some(s => s.session_id === sessionState.sessionId);
        
        if (!isRunning && sessionState.status === 'running') {
          sessionState.status = 'completed';
          clearInterval(monitoringInterval);
          
          // Create final checkpoint
          await this.createSessionCheckpoint(sessionState, 'Session completion checkpoint');
          
          console.log(`✅ Session ${sessionState.sessionId} completed`);
        }
        
        // Update token count if available
        try {
          const output = await api.getClaudeSessionOutput(sessionState.sessionId);
          const tokenCount = this.estimateTokenCount(output);
          sessionState.currentTokens = tokenCount;
          
          // Auto-checkpoint on token milestones
          if (sessionState.checkpointStrategy === 'smart' && 
              tokenCount > 0 && 
              tokenCount % 10000 === 0) {
            await this.createSessionCheckpoint(
              sessionState, 
              `Auto-checkpoint at ${tokenCount} tokens`
            );
          }
          
        } catch (error) {
          // Session output not available, continue monitoring
        }
        
      } catch (error) {
        console.warn(`Session monitoring error for ${sessionState.sessionId}: ${error.message}`);
      }
    }, 10000); // Check every 10 seconds
  }
  
  private estimateTokenCount(output: string): number {
    // Rough token estimation (actual count would require tokenizer)
    return Math.ceil(output.length / 4);
  }
  
  async getSessionStatus(sessionId: string): Promise<SessionState | null> {
    return this.activeSessions.get(sessionId) || null;
  }
  
  async listActiveSessions(): Promise<SessionState[]> {
    return Array.from(this.activeSessions.values());
  }
}

// Supporting types
interface SessionOptions {
  model?: string;
  checkpointStrategy?: CheckpointStrategy;
  autoSave?: boolean;
  maxTokens?: number;
}

interface SessionState {
  sessionId: string;
  projectPath: string;
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed' | 'error';
  startTime: Date;
  checkpointStrategy: CheckpointStrategy;
  autoSave: boolean;
  maxTokens: number;
  currentTokens: number;
  messageCount: number;
  lastActivity: Date;
}

// Usage
const sessionManager = new SessionStateManager();

const sessionId = await sessionManager.createManagedSession(
  '/path/to/project',
  'Help me refactor this authentication system for better security',
  {
    checkpointStrategy: 'smart',
    maxTokens: 50000,
    model: 'opus'
  }
);

await sessionManager.continueSession(
  sessionId,
  'Now let\'s add rate limiting and improve error handling',
  { createCheckpoint: true }
);
```

## MCP Integration Examples

### Dynamic MCP Server Management

```typescript
class DynamicMCPManager {
  private serverTemplates = new Map<string, MCPServerTemplate>();
  
  constructor() {
    this.initializeTemplates();
  }
  
  private initializeTemplates(): void {
    // Database servers
    this.serverTemplates.set('postgres', {
      name: 'PostgreSQL Manager',
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'mcp_postgres'],
      env: {
        'DB_HOST': '${DB_HOST}',
        'DB_PORT': '${DB_PORT}',
        'DB_NAME': '${DB_NAME}',
        'DB_USER': '${DB_USER}',
        'DB_PASSWORD': '${DB_PASSWORD}'
      },
      healthCheck: 'SELECT 1'
    });
    
    this.serverTemplates.set('mongodb', {
      name: 'MongoDB Manager',
      transport: 'stdio',
      command: 'node',
      args: ['./mcp-servers/mongodb.js'],
      env: {
        'MONGO_URL': '${MONGO_URL}',
        'MONGO_DB': '${MONGO_DB}'
      },
      healthCheck: 'db.stats()'
    });
    
    // Development tools
    this.serverTemplates.set('git', {
      name: 'Git Operations',
      transport: 'stdio',
      command: 'node',
      args: ['./mcp-servers/git.js'],
      env: {
        'GIT_REPO': '${PROJECT_PATH}',
        'GIT_USER': '${GIT_USER}',
        'GIT_EMAIL': '${GIT_EMAIL}'
      },
      healthCheck: 'git status'
    });
    
    this.serverTemplates.set('docker', {
      name: 'Docker Manager',
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'mcp_docker'],
      env: {
        'DOCKER_HOST': '${DOCKER_HOST}',
        'PROJECT_NAME': '${PROJECT_NAME}'
      },
      healthCheck: 'docker version'
    });
    
    // Cloud services
    this.serverTemplates.set('aws', {
      name: 'AWS Manager',
      transport: 'stdio',
      command: 'python',
      args: ['-m', 'mcp_aws'],
      env: {
        'AWS_REGION': '${AWS_REGION}',
        'AWS_PROFILE': '${AWS_PROFILE}'
      },
      healthCheck: 'aws sts get-caller-identity'
    });
  }
  
  async setupProjectEnvironment(
    projectPath: string,
    requirements: ProjectRequirements
  ): Promise<SetupResult> {
    console.log(`🔧 Setting up MCP environment for: ${projectPath}`);
    
    const setupResult: SetupResult = {
      projectPath,
      serversConfigured: [],
      errors: [],
      recommendations: []
    };
    
    // Analyze project to determine required servers
    const projectAnalysis = await this.analyzeProject(projectPath);
    const requiredServers = this.determineRequiredServers(projectAnalysis, requirements);
    
    console.log(`📋 Identified ${requiredServers.length} required servers`);
    
    // Configure each required server
    for (const serverType of requiredServers) {
      try {
        const result = await this.configureServer(serverType, projectPath, requirements);
        setupResult.serversConfigured.push(result);
        console.log(`✅ Configured ${serverType} server`);
      } catch (error) {
        const errorMessage = `Failed to configure ${serverType}: ${error.message}`;
        setupResult.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }
    
    // Test all configured servers
    await this.testConfiguredServers(setupResult.serversConfigured);
    
    // Generate recommendations
    setupResult.recommendations = this.generateRecommendations(projectAnalysis, setupResult);
    
    return setupResult;
  }
  
  private async analyzeProject(projectPath: string): Promise<ProjectAnalysis> {
    const analysis: ProjectAnalysis = {
      languages: [],
      frameworks: [],
      databases: [],
      cloudServices: [],
      buildTools: [],
      hasDockerfile: false,
      hasGitRepo: false,
      packageFiles: []
    };
    
    try {
      const contents = await api.listDirectoryContents(projectPath);
      
      // Detect package files and languages
      for (const file of contents) {
        if (file.is_directory) continue;
        
        switch (file.name) {
          case 'package.json':
            analysis.packageFiles.push('package.json');
            analysis.languages.push('javascript');
            break;
          case 'requirements.txt':
          case 'pyproject.toml':
            analysis.packageFiles.push(file.name);
            analysis.languages.push('python');
            break;
          case 'Cargo.toml':
            analysis.packageFiles.push('Cargo.toml');
            analysis.languages.push('rust');
            break;
          case 'go.mod':
            analysis.packageFiles.push('go.mod');
            analysis.languages.push('go');
            break;
          case 'Dockerfile':
            analysis.hasDockerfile = true;
            break;
          case '.git':
            analysis.hasGitRepo = true;
            break;
        }
      }
      
      // Analyze package files for dependencies
      if (analysis.packageFiles.includes('package.json')) {
        await this.analyzePackageJson(projectPath, analysis);
      }
      
      if (analysis.packageFiles.includes('requirements.txt')) {
        await this.analyzeRequirementsTxt(projectPath, analysis);
      }
      
    } catch (error) {
      console.warn(`Project analysis failed: ${error.message}`);
    }
    
    return analysis;
  }
  
  private async analyzePackageJson(projectPath: string, analysis: ProjectAnalysis): Promise<void> {
    try {
      const packageContent = await api.readClaudeMdFile(`${projectPath}/package.json`);
      const packageJson = JSON.parse(packageContent);
      
      const dependencies = { 
        ...packageJson.dependencies, 
        ...packageJson.devDependencies 
      };
      
      // Detect frameworks
      if (dependencies.react) analysis.frameworks.push('react');
      if (dependencies.vue) analysis.frameworks.push('vue');
      if (dependencies.angular) analysis.frameworks.push('angular');
      if (dependencies.express) analysis.frameworks.push('express');
      if (dependencies.next) analysis.frameworks.push('nextjs');
      
      // Detect databases
      if (dependencies.pg || dependencies['node-postgres']) analysis.databases.push('postgresql');
      if (dependencies.mongodb || dependencies.mongoose) analysis.databases.push('mongodb');
      if (dependencies.mysql || dependencies.mysql2) analysis.databases.push('mysql');
      if (dependencies.redis) analysis.databases.push('redis');
      
      // Detect build tools
      if (dependencies.webpack) analysis.buildTools.push('webpack');
      if (dependencies.vite) analysis.buildTools.push('vite');
      if (dependencies.rollup) analysis.buildTools.push('rollup');
      
    } catch (error) {
      console.warn(`Failed to analyze package.json: ${error.message}`);
    }
  }
  
  private async analyzeRequirementsTxt(projectPath: string, analysis: ProjectAnalysis): Promise<void> {
    try {
      const requirements = await api.readClaudeMdFile(`${projectPath}/requirements.txt`);
      const lines = requirements.split('\n').map(line => line.trim().toLowerCase());
      
      // Detect frameworks
      if (lines.some(line => line.startsWith('django'))) analysis.frameworks.push('django');
      if (lines.some(line => line.startsWith('flask'))) analysis.frameworks.push('flask');
      if (lines.some(line => line.startsWith('fastapi'))) analysis.frameworks.push('fastapi');
      
      // Detect databases
      if (lines.some(line => line.includes('psycopg'))) analysis.databases.push('postgresql');
      if (lines.some(line => line.includes('pymongo'))) analysis.databases.push('mongodb');
      if (lines.some(line => line.includes('mysql'))) analysis.databases.push('mysql');
      
    } catch (error) {
      console.warn(`Failed to analyze requirements.txt: ${error.message}`);
    }
  }
  
  private determineRequiredServers(
    analysis: ProjectAnalysis,
    requirements: ProjectRequirements
  ): string[] {
    const servers = new Set<string>();
    
    // Always include git if repo exists
    if (analysis.hasGitRepo) {
      servers.add('git');
    }
    
    // Add database servers
    for (const db of analysis.databases) {
      if (db === 'postgresql') servers.add('postgres');
      if (db === 'mongodb') servers.add('mongodb');
    }
    
    // Add docker if Dockerfile exists
    if (analysis.hasDockerfile) {
      servers.add('docker');
    }
    
    // Add cloud services based on requirements
    if (requirements.cloudProvider === 'aws') {
      servers.add('aws');
    }
    
    // Add development tools
    if (requirements.includeDevelopmentTools) {
      servers.add('file-manager');
      servers.add('process-monitor');
    }
    
    return Array.from(servers);
  }
  
  private async configureServer(
    serverType: string,
    projectPath: string,
    requirements: ProjectRequirements
  ): Promise<ServerConfigResult> {
    const template = this.serverTemplates.get(serverType);
    if (!template) {
      throw new Error(`No template found for server type: ${serverType}`);
    }
    
    // Interpolate environment variables
    const env = this.interpolateEnvironment(template.env, {
      PROJECT_PATH: projectPath,
      PROJECT_NAME: projectPath.split('/').pop() || 'project',
      ...requirements.environment
    });
    
    // Generate unique server name
    const serverName = `${template.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    
    // Add server
    const result = await api.mcpAdd(
      serverName,
      template.transport,
      template.command,
      template.args,
      env,
      undefined,
      'project'
    );
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    return {
      serverName,
      serverType,
      template: template.name,
      status: 'configured'
    };
  }
  
  private interpolateEnvironment(
    envTemplate: Record<string, string>,
    variables: Record<string, string>
  ): Record<string, string> {
    const env: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(envTemplate)) {
      let interpolated = value;
      
      // Replace ${VAR} patterns
      for (const [varName, varValue] of Object.entries(variables)) {
        interpolated = interpolated.replace(
          new RegExp(`\\$\\{${varName}\\}`, 'g'),
          varValue
        );
      }
      
      env[key] = interpolated;
    }
    
    return env;
  }
  
  private async testConfiguredServers(servers: ServerConfigResult[]): Promise<void> {
    console.log(`🧪 Testing ${servers.length} configured servers`);
    
    for (const server of servers) {
      try {
        const testResult = await api.mcpTestConnection(server.serverName);
        server.status = 'tested';
        server.testResult = testResult;
        console.log(`✅ ${server.serverName}: ${testResult}`);
      } catch (error) {
        server.status = 'test_failed';
        server.testResult = error.message;
        console.warn(`⚠️ ${server.serverName}: Test failed - ${error.message}`);
      }
    }
  }
  
  private generateRecommendations(
    analysis: ProjectAnalysis,
    setupResult: SetupResult
  ): string[] {
    const recommendations: string[] = [];
    
    // Recommend additional servers based on project analysis
    if (analysis.frameworks.includes('react') && !setupResult.serversConfigured.some(s => s.serverType === 'bundler')) {
      recommendations.push('Consider adding a bundler analyzer server for webpack/vite optimization');
    }
    
    if (analysis.hasDockerfile && !setupResult.serversConfigured.some(s => s.serverType === 'docker')) {
      recommendations.push('Add Docker manager server for container operations');
    }
    
    if (analysis.databases.length > 0 && !setupResult.serversConfigured.some(s => s.serverType.includes('database'))) {
      recommendations.push('Configure database management servers for your detected databases');
    }
    
    // Performance recommendations
    if (setupResult.serversConfigured.length > 5) {
      recommendations.push('Consider grouping servers or using server pooling for better performance');
    }
    
    // Security recommendations
    recommendations.push('Regularly test MCP server connections and update credentials');
    recommendations.push('Monitor MCP server logs for security events');
    
    return recommendations;
  }
}

// Supporting types
interface MCPServerTemplate {
  name: string;
  transport: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  healthCheck: string;
}

interface ProjectRequirements {
  cloudProvider?: 'aws' | 'azure' | 'gcp';
  includeDevelopmentTools?: boolean;
  environment: Record<string, string>;
}

interface ProjectAnalysis {
  languages: string[];
  frameworks: string[];
  databases: string[];
  cloudServices: string[];
  buildTools: string[];
  hasDockerfile: boolean;
  hasGitRepo: boolean;
  packageFiles: string[];
}

interface SetupResult {
  projectPath: string;
  serversConfigured: ServerConfigResult[];
  errors: string[];
  recommendations: string[];
}

interface ServerConfigResult {
  serverName: string;
  serverType: string;
  template: string;
  status: 'configured' | 'tested' | 'test_failed';
  testResult?: string;
}

// Usage
const mcpManager = new DynamicMCPManager();

const setupResult = await mcpManager.setupProjectEnvironment('/path/to/project', {
  cloudProvider: 'aws',
  includeDevelopmentTools: true,
  environment: {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    AWS_REGION: 'us-west-2'
  }
});

console.log(`✅ MCP setup complete: ${setupResult.serversConfigured.length} servers configured`);
setupResult.recommendations.forEach(rec => console.log(`💡 ${rec}`));
```

## Analytics and Monitoring

### Comprehensive Analytics Dashboard

```typescript
class AnalyticsDashboard {
  async generateComprehensiveReport(options: ReportOptions = {}): Promise<AnalyticsReport> {
    console.log('📊 Generating comprehensive analytics report...');
    
    const timeRange = options.timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };
    
    // Gather all analytics data
    const [
      usageStats,
      projectStats,
      agentRuns,
      checkpointData,
      mcpServerStatus
    ] = await Promise.all([
      this.getUsageAnalytics(timeRange),
      this.getProjectAnalytics(timeRange),
      this.getAgentAnalytics(timeRange),
      this.getCheckpointAnalytics(timeRange),
      this.getMCPAnalytics()
    ]);
    
    // Generate insights
    const insights = this.generateInsights({
      usage: usageStats,
      projects: projectStats,
      agents: agentRuns,
      checkpoints: checkpointData,
      mcp: mcpServerStatus
    });
    
    const report: AnalyticsReport = {
      timeRange,
      timestamp: new Date(),
      usage: usageStats,
      projects: projectStats,
      agents: agentRuns,
      checkpoints: checkpointData,
      mcp: mcpServerStatus,
      insights,
      summary: this.generateExecutiveSummary(insights)
    };
    
    // Display report
    this.displayReport(report);
    
    return report;
  }
  
  private async getUsageAnalytics(timeRange: TimeRange): Promise<UsageAnalytics> {
    const stats = await api.getUsageByDateRange(
      timeRange.start.toISOString().split('T')[0],
      timeRange.end.toISOString().split('T')[0]
    );
    
    // Calculate trends
    const dailyCosts = stats.by_date.map(d => d.total_cost);
    const costTrend = this.calculateTrend(dailyCosts);
    
    const dailyTokens = stats.by_date.map(d => d.total_tokens);
    const tokenTrend = this.calculateTrend(dailyTokens);
    
    // Model efficiency analysis
    const modelEfficiency = stats.by_model.map(model => ({
      model: model.model,
      costPerToken: model.total_cost / model.total_tokens,
      avgCostPerSession: model.total_cost / model.session_count,
      tokenUtilization: model.total_tokens / model.session_count
    }));
    
    return {
      totalCost: stats.total_cost,
      totalTokens: stats.total_tokens,
      totalSessions: stats.total_sessions,
      costTrend,
      tokenTrend,
      modelBreakdown: stats.by_model,
      modelEfficiency,
      dailyUsage: stats.by_date,
      peakUsageDay: stats.by_date.reduce((peak, day) => 
        day.total_cost > peak.total_cost ? day : peak
      )
    };
  }
  
  private async getProjectAnalytics(timeRange: TimeRange): Promise<ProjectAnalytics> {
    const projectStats = await api.getSessionStats(
      timeRange.start.toISOString().slice(0, 10).replace(/-/g, ''),
      timeRange.end.toISOString().slice(0, 10).replace(/-/g, ''),
      'desc'
    );
    
    // Calculate project health scores
    const projectHealth = projectStats.map(project => ({
      ...project,
      healthScore: this.calculateProjectHealthScore(project),
      efficiency: project.total_cost / project.session_count,
      activity: project.session_count / this.daysBetween(timeRange.start, timeRange.end)
    }));
    
    // Identify trends
    const topProjects = projectHealth.slice(0, 10);
    const underutilizedProjects = projectHealth.filter(p => p.activity < 0.1);
    const highCostProjects = projectHealth.filter(p => p.total_cost > 5.0);
    
    return {
      totalProjects: projectStats.length,
      activeProjects: projectStats.filter(p => p.session_count > 0).length,
      topProjects,
      underutilizedProjects,
      highCostProjects,
      averageProjectCost: projectStats.reduce((sum, p) => sum + p.total_cost, 0) / projectStats.length,
      projectHealthDistribution: this.groupBy(projectHealth, p => this.getHealthCategory(p.healthScore))
    };
  }
  
  private async getAgentAnalytics(timeRange: TimeRange): Promise<AgentAnalytics> {
    const allRuns = await api.listAgentRuns();
    
    // Filter runs within time range
    const runsInRange = allRuns.filter(run => {
      const runDate = new Date(run.created_at);
      return runDate >= timeRange.start && runDate <= timeRange.end;
    });
    
    // Agent performance metrics
    const agentPerformance = this.groupBy(runsInRange, run => run.agent_id)
      .map(([agentId, runs]) => {
        const completedRuns = runs.filter(r => r.status === 'completed');
        const totalCost = completedRuns.reduce((sum, r) => sum + (r.metrics?.cost_usd || 0), 0);
        const totalTokens = completedRuns.reduce((sum, r) => sum + (r.metrics?.total_tokens || 0), 0);
        const avgDuration = completedRuns.reduce((sum, r) => sum + (r.metrics?.duration_ms || 0), 0) / completedRuns.length;
        
        return {
          agentId: parseInt(agentId),
          agentName: runs[0].agent_name,
          totalRuns: runs.length,
          completedRuns: completedRuns.length,
          successRate: completedRuns.length / runs.length,
          totalCost,
          totalTokens,
          avgDuration,
          costEfficiency: totalTokens / totalCost,
          reliability: completedRuns.length / runs.length
        };
      });
    
    // Identify top performers
    const topPerformers = agentPerformance
      .sort((a, b) => b.costEfficiency - a.costEfficiency)
      .slice(0, 5);
    
    const mostReliable = agentPerformance
      .sort((a, b) => b.reliability - a.reliability)
      .slice(0, 5);
    
    return {
      totalRuns: runsInRange.length,
      completedRuns: runsInRange.filter(r => r.status === 'completed').length,
      averageSuccessRate: agentPerformance.reduce((sum, a) => sum + a.successRate, 0) / agentPerformance.length,
      agentPerformance,
      topPerformers,
      mostReliable,
      statusDistribution: this.groupBy(runsInRange, run => run.status)
    };
  }
  
  private async getCheckpointAnalytics(timeRange: TimeRange): Promise<CheckpointAnalytics> {
    // This would require access to checkpoint data
    // For now, we'll simulate based on available session data
    const projects = await api.listProjects();
    
    let totalCheckpoints = 0;
    let checkpointsByProject: Record<string, number> = {};
    
    for (const project of projects) {
      try {
        const sessions = await api.getProjectSessions(project.id);
        
        for (const session of sessions) {
          try {
            const checkpoints = await api.listCheckpoints(session.id, project.id, project.path);
            const recentCheckpoints = checkpoints.filter(cp => {
              const cpDate = new Date(cp.timestamp);
              return cpDate >= timeRange.start && cpDate <= timeRange.end;
            });
            
            totalCheckpoints += recentCheckpoints.length;
            checkpointsByProject[project.path] = (checkpointsByProject[project.path] || 0) + recentCheckpoints.length;
          } catch (error) {
            // Session may not have checkpoints
          }
        }
      } catch (error) {
        // Project may not be accessible
      }
    }
    
    return {
      totalCheckpoints,
      checkpointsByProject,
      averageCheckpointsPerProject: totalCheckpoints / projects.length,
      mostActiveProjects: Object.entries(checkpointsByProject)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([project, count]) => ({ project, checkpoints: count }))
    };
  }
  
  private async getMCPAnalytics(): Promise<MCPAnalytics> {
    const servers = await api.mcpList();
    const serverStatus = await api.mcpGetServerStatus();
    
    const runningServers = servers.filter(s => serverStatus[s.name]?.running);
    const failedServers = servers.filter(s => serverStatus[s.name]?.error);
    
    const serversByScope = this.groupBy(servers, s => s.scope);
    const serversByTransport = this.groupBy(servers, s => s.transport);
    
    return {
      totalServers: servers.length,
      runningServers: runningServers.length,
      failedServers: failedServers.length,
      healthyPercentage: (runningServers.length / servers.length) * 100,
      serversByScope,
      serversByTransport,
      recentFailures: failedServers.map(s => ({
        name: s.name,
        error: serverStatus[s.name]?.error || 'Unknown error',
        lastChecked: serverStatus[s.name]?.last_checked
      }))
    };
  }
  
  private generateInsights(data: AnalyticsData): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    // Cost insights
    if (data.usage.costTrend > 0.1) {
      insights.push({
        type: 'cost',
        severity: 'high',
        title: 'Rising Costs Detected',
        description: `Daily costs have increased by ${(data.usage.costTrend * 100).toFixed(1)}% over the analysis period`,
        recommendation: 'Consider optimizing model usage or implementing cost controls'
      });
    }
    
    // Model efficiency insights
    const inefficientModels = data.usage.modelEfficiency.filter(m => m.costPerToken > 0.00008);
    if (inefficientModels.length > 0) {
      insights.push({
        type: 'efficiency',
        severity: 'medium',
        title: 'Model Efficiency Opportunity',
        description: `${inefficientModels.length} models show high cost per token`,
        recommendation: 'Consider using Haiku for routine tasks to reduce costs'
      });
    }
    
    // Project activity insights
    if (data.projects.underutilizedProjects.length > 0) {
      insights.push({
        type: 'usage',
        severity: 'low',
        title: 'Underutilized Projects',
        description: `${data.projects.underutilizedProjects.length} projects have minimal activity`,
        recommendation: 'Review project relevance or archive inactive projects'
      });
    }
    
    // Agent performance insights
    if (data.agents.averageSuccessRate < 0.8) {
      insights.push({
        type: 'reliability',
        severity: 'high',
        title: 'Agent Reliability Concerns',
        description: `Average agent success rate is ${(data.agents.averageSuccessRate * 100).toFixed(1)}%`,
        recommendation: 'Review failing agents and improve error handling'
      });
    }
    
    // MCP health insights
    if (data.mcp.healthyPercentage < 90) {
      insights.push({
        type: 'infrastructure',
        severity: 'medium',
        title: 'MCP Server Issues',
        description: `${data.mcp.failedServers} MCP servers are not responding`,
        recommendation: 'Check server configurations and restart failed services'
      });
    }
    
    return insights;
  }
  
  private generateExecutiveSummary(insights: AnalyticsInsight[]): string {
    const highSeverityCount = insights.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = insights.filter(i => i.severity === 'medium').length;
    
    let summary = '📊 Analytics Summary:\n\n';
    
    if (highSeverityCount > 0) {
      summary += `🚨 ${highSeverityCount} high-priority issues require immediate attention\n`;
    }
    
    if (mediumSeverityCount > 0) {
      summary += `⚠️ ${mediumSeverityCount} medium-priority optimization opportunities identified\n`;
    }
    
    if (highSeverityCount === 0 && mediumSeverityCount === 0) {
      summary += '✅ No critical issues detected - system operating within normal parameters\n';
    }
    
    summary += '\n🎯 Key Recommendations:\n';
    insights.slice(0, 3).forEach((insight, index) => {
      summary += `${index + 1}. ${insight.recommendation}\n`;
    });
    
    return summary;
  }
  
  private displayReport(report: AnalyticsReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 CLAUDIA ANALYTICS REPORT');
    console.log('='.repeat(60));
    
    console.log(`📅 Period: ${report.timeRange.start.toDateString()} - ${report.timeRange.end.toDateString()}`);
    console.log(`📊 Generated: ${report.timestamp.toLocaleString()}\n`);
    
    // Usage overview
    console.log('💰 USAGE OVERVIEW');
    console.log('-'.repeat(20));
    console.log(`Total Cost: $${report.usage.totalCost.toFixed(4)}`);
    console.log(`Total Tokens: ${report.usage.totalTokens.toLocaleString()}`);
    console.log(`Total Sessions: ${report.usage.totalSessions}`);
    console.log(`Cost Trend: ${report.usage.costTrend > 0 ? '↗️' : '↘️'} ${(report.usage.costTrend * 100).toFixed(1)}%\n`);
    
    // Project overview
    console.log('📁 PROJECT OVERVIEW');
    console.log('-'.repeat(20));
    console.log(`Active Projects: ${report.projects.activeProjects}/${report.projects.totalProjects}`);
    console.log(`Average Project Cost: $${report.projects.averageProjectCost.toFixed(4)}`);
    console.log('\nTop 3 Projects:');
    report.projects.topProjects.slice(0, 3).forEach((project, index) => {
      console.log(`  ${index + 1}. ${project.project_name}: $${project.total_cost.toFixed(4)}`);
    });
    
    // Agent overview
    console.log('\n🤖 AGENT OVERVIEW');
    console.log('-'.repeat(20));
    console.log(`Total Runs: ${report.agents.totalRuns}`);
    console.log(`Success Rate: ${(report.agents.averageSuccessRate * 100).toFixed(1)}%`);
    console.log('\nTop Performing Agents:');
    report.agents.topPerformers.slice(0, 3).forEach((agent, index) => {
      console.log(`  ${index + 1}. ${agent.agentName}: ${(agent.costEfficiency).toFixed(0)} tokens/$`);
    });
    
    // Key insights
    console.log('\n🎯 KEY INSIGHTS');
    console.log('-'.repeat(20));
    report.insights.forEach((insight, index) => {
      const emoji = insight.severity === 'high' ? '🚨' : insight.severity === 'medium' ? '⚠️' : 'ℹ️';
      console.log(`${emoji} ${insight.title}`);
      console.log(`   ${insight.description}`);
      console.log(`   💡 ${insight.recommendation}\n`);
    });
    
    console.log('='.repeat(60));
  }
  
  // Utility methods
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    
    return (secondAvg - firstAvg) / firstAvg;
  }
  
  private calculateProjectHealthScore(project: ProjectUsage): number {
    // Health score based on activity, cost efficiency, and recency
    const activityScore = Math.min(project.session_count / 10, 1); // Max score at 10+ sessions
    const costScore = Math.max(0, 1 - (project.total_cost / 10)); // Lower cost = higher score
    const recencyScore = this.getRecencyScore(project.last_used);
    
    return (activityScore + costScore + recencyScore) / 3;
  }
  
  private getRecencyScore(lastUsed: string): number {
    const daysSinceLastUse = (Date.now() - new Date(lastUsed).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSinceLastUse / 30); // Score decreases over 30 days
  }
  
  private getHealthCategory(score: number): string {
    if (score > 0.7) return 'healthy';
    if (score > 0.4) return 'moderate';
    return 'poor';
  }
  
  private groupBy<T, K extends string | number>(
    array: T[], 
    keyFn: (item: T) => K
  ): Array<[string, T[]]> {
    const groups = array.reduce((acc, item) => {
      const key = String(keyFn(item));
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, T[]>);
    
    return Object.entries(groups);
  }
  
  private daysBetween(date1: Date, date2: Date): number {
    return Math.ceil((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
  }
}

// Supporting types
interface ReportOptions {
  timeRange?: TimeRange;
  includeDetails?: boolean;
  exportFormat?: 'console' | 'json' | 'csv';
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface AnalyticsReport {
  timeRange: TimeRange;
  timestamp: Date;
  usage: UsageAnalytics;
  projects: ProjectAnalytics;
  agents: AgentAnalytics;
  checkpoints: CheckpointAnalytics;
  mcp: MCPAnalytics;
  insights: AnalyticsInsight[];
  summary: string;
}

interface UsageAnalytics {
  totalCost: number;
  totalTokens: number;
  totalSessions: number;
  costTrend: number;
  tokenTrend: number;
  modelBreakdown: ModelUsage[];
  modelEfficiency: Array<{
    model: string;
    costPerToken: number;
    avgCostPerSession: number;
    tokenUtilization: number;
  }>;
  dailyUsage: DailyUsage[];
  peakUsageDay: DailyUsage;
}

interface ProjectAnalytics {
  totalProjects: number;
  activeProjects: number;
  topProjects: (ProjectUsage & { healthScore: number; efficiency: number; activity: number })[];
  underutilizedProjects: (ProjectUsage & { healthScore: number; efficiency: number; activity: number })[];
  highCostProjects: (ProjectUsage & { healthScore: number; efficiency: number; activity: number })[];
  averageProjectCost: number;
  projectHealthDistribution: Array<[string, (ProjectUsage & { healthScore: number; efficiency: number; activity: number })[]]>;
}

interface AgentAnalytics {
  totalRuns: number;
  completedRuns: number;
  averageSuccessRate: number;
  agentPerformance: Array<{
    agentId: number;
    agentName: string;
    totalRuns: number;
    completedRuns: number;
    successRate: number;
    totalCost: number;
    totalTokens: number;
    avgDuration: number;
    costEfficiency: number;
    reliability: number;
  }>;
  topPerformers: Array<{
    agentId: number;
    agentName: string;
    totalRuns: number;
    completedRuns: number;
    successRate: number;
    totalCost: number;
    totalTokens: number;
    avgDuration: number;
    costEfficiency: number;
    reliability: number;
  }>;
  mostReliable: Array<{
    agentId: number;
    agentName: string;
    totalRuns: number;
    completedRuns: number;
    successRate: number;
    totalCost: number;
    totalTokens: number;
    avgDuration: number;
    costEfficiency: number;
    reliability: number;
  }>;
  statusDistribution: Array<[string, AgentRunWithMetrics[]]>;
}

interface CheckpointAnalytics {
  totalCheckpoints: number;
  checkpointsByProject: Record<string, number>;
  averageCheckpointsPerProject: number;
  mostActiveProjects: Array<{ project: string; checkpoints: number }>;
}

interface MCPAnalytics {
  totalServers: number;
  runningServers: number;
  failedServers: number;
  healthyPercentage: number;
  serversByScope: Array<[string, MCPServer[]]>;
  serversByTransport: Array<[string, MCPServer[]]>;
  recentFailures: Array<{
    name: string;
    error: string;
    lastChecked?: number;
  }>;
}

interface AnalyticsData {
  usage: UsageAnalytics;
  projects: ProjectAnalytics;
  agents: AgentAnalytics;
  checkpoints: CheckpointAnalytics;
  mcp: MCPAnalytics;
}

interface AnalyticsInsight {
  type: 'cost' | 'efficiency' | 'usage' | 'reliability' | 'infrastructure';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
}

// Usage
const dashboard = new AnalyticsDashboard();
const report = await dashboard.generateComprehensiveReport({
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  }
});
```

## Complete Applications

### Full-Featured Development Assistant

```typescript
class ClaudeDevelopmentAssistant {
  private sessionManager: SessionStateManager;
  private agentOrchestrator: AgentOrchestrator;
  private mcpManager: DynamicMCPManager;
  private analytics: AnalyticsDashboard;
  
  constructor() {
    this.sessionManager = new SessionStateManager();
    this.agentOrchestrator = new AgentOrchestrator();
    this.mcpManager = new DynamicMCPManager();
    this.analytics = new AnalyticsDashboard();
  }
  
  async startDevelopmentSession(
    projectPath: string,
    goal: string,
    options: DevelopmentSessionOptions = {}
  ): Promise<DevelopmentSession> {
    console.log(`🚀 Starting development session: ${goal}`);
    
    // Initialize project environment
    await this.setupProjectEnvironment(projectPath, options);
    
    // Create managed session
    const sessionId = await this.sessionManager.createManagedSession(
      projectPath,
      `I want to ${goal}. Please help me plan and implement this feature.`,
      {
        checkpointStrategy: 'smart',
        model: options.model || 'sonnet'
      }
    );
    
    // Set up specialized agents
    const agents = await this.createSessionAgents(goal, options.specializations || []);
    
    // Create development session
    const session: DevelopmentSession = {
      sessionId,
      projectPath,
      goal,
      agents,
      status: 'active',
      startTime: new Date(),
      checkpoints: [],
      activities: []
    };
    
    console.log(`✅ Development session initialized: ${sessionId}`);
    return session;
  }
  
  private async setupProjectEnvironment(
    projectPath: string,
    options: DevelopmentSessionOptions
  ): Promise<void> {
    // Set up MCP servers based on project type
    if (options.autoSetupMCP !== false) {
      await this.mcpManager.setupProjectEnvironment(projectPath, {
        cloudProvider: options.cloudProvider,
        includeDevelopmentTools: true,
        environment: options.environment || {}
      });
    }
    
    // Create project-specific CLAUDE.md if needed
    try {
      const claudeFiles = await api.findClaudeMdFiles(projectPath);
      if (claudeFiles.length === 0 && options.createSystemPrompt !== false) {
        await this.createProjectSystemPrompt(projectPath, options.projectType);
      }
    } catch (error) {
      console.warn(`Failed to setup project environment: ${error.message}`);
    }
  }
  
  private async createProjectSystemPrompt(
    projectPath: string,
    projectType?: string
  ): Promise<void> {
    const projectName = projectPath.split('/').pop() || 'project';
    
    const systemPrompt = `# ${projectName} Development Assistant

You are a specialized development assistant for this ${projectType || 'software'} project.

## Project Context
- **Location**: ${projectPath}
- **Type**: ${projectType || 'General software project'}
- **Assistant Role**: Senior developer and architect

## Your Capabilities
- Code review and improvement suggestions
- Architecture and design guidance
- Bug identification and resolution
- Performance optimization recommendations
- Testing strategy development
- Documentation generation

## Development Standards
- Follow established coding conventions
- Prioritize code readability and maintainability
- Implement comprehensive error handling
- Write meaningful tests for new features
- Document significant design decisions

## Communication Style
- Provide clear, actionable recommendations
- Explain the reasoning behind suggestions
- Offer multiple solutions when appropriate
- Ask clarifying questions when requirements are unclear

Always consider the broader project context when making recommendations.`;

    await api.saveClaudeMdFile(`${projectPath}/CLAUDE.md`, systemPrompt);
    console.log('📝 Created project system prompt');
  }
  
  private async createSessionAgents(
    goal: string,
    specializations: string[]
  ): Promise<Agent[]> {
    const agents: Agent[] = [];
    
    // Create goal-specific agent
    const goalAgent = await api.createAgent(
      `Goal Assistant: ${goal.slice(0, 50)}`,
      'bot',
      `You are a specialized assistant focused on helping achieve this goal: "${goal}"
      
      Your responsibilities:
      - Break down the goal into actionable tasks
      - Provide step-by-step implementation guidance
      - Monitor progress and suggest course corrections
      - Ensure the final implementation meets the goal requirements
      
      Be proactive in identifying potential challenges and solutions.`,
      `Help implement: ${goal}`,
      'sonnet'
    );
    
    agents.push(goalAgent);
    
    // Add specialized agents based on requirements
    for (const specialization of specializations) {
      try {
        const specializationTeam = await AgentFactory.createSpecializedTeam(specialization);
        agents.push(...specializationTeam);
      } catch (error) {
        console.warn(`Failed to create ${specialization} team: ${error.message}`);
      }
    }
    
    return agents;
  }
  
  async executeWorkflowStep(
    session: DevelopmentSession,
    step: WorkflowStep
  ): Promise<WorkflowResult> {
    console.log(`⚡ Executing step: ${step.name}`);
    
    const result: WorkflowResult = {
      stepName: step.name,
      status: 'running',
      startTime: new Date(),
      outputs: []
    };
    
    try {
      switch (step.type) {
        case 'analysis':
          result.outputs = await this.executeAnalysisStep(session, step);
          break;
        case 'implementation':
          result.outputs = await this.executeImplementationStep(session, step);
          break;
        case 'review':
          result.outputs = await this.executeReviewStep(session, step);
          break;
        case 'testing':
          result.outputs = await this.executeTestingStep(session, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      result.status = 'completed';
      result.endTime = new Date();
      
      // Create checkpoint after successful step
      if (step.createCheckpoint) {
        await this.createWorkflowCheckpoint(session, step.name);
      }
      
    } catch (error) {
      result.status = 'failed';
      result.error = error instanceof Error ? error.message : String(error);
      result.endTime = new Date();
    }
    
    session.activities.push(result);
    return result;
  }
  
  private async executeAnalysisStep(
    session: DevelopmentSession,
    step: WorkflowStep
  ): Promise<WorkflowOutput[]> {
    // Run analysis agents
    const analysisAgents = session.agents.filter(a => 
      a.name.includes('Review') || a.name.includes('Analyzer')
    );
    
    const outputs: WorkflowOutput[] = [];
    
    for (const agent of analysisAgents) {
      const runId = await api.executeAgent(
        agent.id!,
        session.projectPath,
        step.description || `Analyze the current state for: ${session.goal}`
      );
      
      outputs.push({
        type: 'agent_execution',
        agentName: agent.name,
        runId,
        description: 'Analysis in progress'
      });
    }
    
    return outputs;
  }
  
  private async executeImplementationStep(
    session: DevelopmentSession,
    step: WorkflowStep
  ): Promise<WorkflowOutput[]> {
    // Continue the main session with implementation instructions
    await this.sessionManager.continueSession(
      session.sessionId,
      step.description || `Implement the next part of: ${session.goal}`,
      { createCheckpoint: true }
    );
    
    return [{
      type: 'session_continuation',
      description: 'Implementation step executed',
      sessionId: session.sessionId
    }];
  }
  
  private async executeReviewStep(
    session: DevelopmentSession,
    step: WorkflowStep
  ): Promise<WorkflowOutput[]> {
    // Run comprehensive code review
    const report = await this.agentOrchestrator.orchestrateCodeReview(session.projectPath);
    
    return [{
      type: 'code_review',
      description: 'Comprehensive code review completed',
      data: report
    }];
  }
  
  private async executeTestingStep(
    session: DevelopmentSession,
    step: WorkflowStep
  ): Promise<WorkflowOutput[]> {
    const testingAgents = session.agents.filter(a => a.name.includes('Test'));
    const outputs: WorkflowOutput[] = [];
    
    for (const agent of testingAgents) {
      const runId = await api.executeAgent(
        agent.id!,
        session.projectPath,
        step.description || 'Generate comprehensive tests for the implemented features'
      );
      
      outputs.push({
        type: 'agent_execution',
        agentName: agent.name,
        runId,
        description: 'Test generation in progress'
      });
    }
    
    return outputs;
  }
  
  private async createWorkflowCheckpoint(
    session: DevelopmentSession,
    stepName: string
  ): Promise<void> {
    try {
      const projects = await api.listProjects();
      const project = projects.find(p => p.path === session.projectPath);
      
      if (project) {
        const result = await api.createCheckpoint(
          session.sessionId,
          project.id,
          session.projectPath,
          undefined,
          `Workflow checkpoint: ${stepName}`
        );
        
        session.checkpoints.push(result.checkpoint);
        console.log(`📍 Workflow checkpoint created: ${stepName}`);
      }
    } catch (error) {
      console.warn(`Failed to create workflow checkpoint: ${error.message}`);
    }
  }
  
  async generateSessionReport(session: DevelopmentSession): Promise<SessionReport> {
    console.log('📊 Generating session report...');
    
    // Gather session metrics
    const sessionState = await this.sessionManager.getSessionStatus(session.sessionId);
    const completedActivities = session.activities.filter(a => a.status === 'completed');
    const totalDuration = session.activities.reduce((sum, a) => {
      if (a.endTime && a.startTime) {
        return sum + (a.endTime.getTime() - a.startTime.getTime());
      }
      return sum;
    }, 0);
    
    // Get agent performance
    const agentMetrics = await Promise.all(
      session.agents.map(async agent => {
        const runs = await api.listAgentRuns(agent.id);
        const sessionRuns = runs.filter(run => 
          run.project_path === session.projectPath &&
          new Date(run.created_at) >= session.startTime
        );
        
        return {
          agent: agent.name,
          runs: sessionRuns.length,
          completed: sessionRuns.filter(r => r.status === 'completed').length,
          totalCost: sessionRuns.reduce((sum, r) => sum + (r.metrics?.cost_usd || 0), 0),
          totalTokens: sessionRuns.reduce((sum, r) => sum + (r.metrics?.total_tokens || 0), 0)
        };
      })
    );
    
    const report: SessionReport = {
      session,
      duration: totalDuration,
      completedActivities: completedActivities.length,
      totalActivities: session.activities.length,
      checkpointsCreated: session.checkpoints.length,
      agentMetrics,
      totalCost: agentMetrics.reduce((sum, m) => sum + m.totalCost, 0),
      totalTokens: agentMetrics.reduce((sum, m) => sum + m.totalTokens, 0),
      successRate: completedActivities.length / session.activities.length,
      recommendations: this.generateSessionRecommendations(session, agentMetrics)
    };
    
    this.displaySessionReport(report);
    return report;
  }
  
  private generateSessionRecommendations(
    session: DevelopmentSession,
    agentMetrics: any[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Activity success rate
    const successRate = session.activities.filter(a => a.status === 'completed').length / session.activities.length;
    if (successRate < 0.8) {
      recommendations.push('Consider breaking down complex tasks into smaller steps');
    }
    
    // Agent utilization
    const unusedAgents = agentMetrics.filter(m => m.runs === 0);
    if (unusedAgents.length > 0) {
      recommendations.push(`${unusedAgents.length} agents were not utilized - consider streamlining agent selection`);
    }
    
    // Cost efficiency
    const totalCost = agentMetrics.reduce((sum, m) => sum + m.totalCost, 0);
    if (totalCost > 5.0) {
      recommendations.push('High session cost detected - consider using more efficient models for routine tasks');
    }
    
    // Checkpoint strategy
    if (session.checkpoints.length < 3) {
      recommendations.push('Consider creating more checkpoints for better session recovery');
    }
    
    return recommendations;
  }
  
  private displaySessionReport(report: SessionReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DEVELOPMENT SESSION REPORT');
    console.log('='.repeat(60));
    
    console.log(`🎯 Goal: ${report.session.goal}`);
    console.log(`📁 Project: ${report.session.projectPath}`);
    console.log(`⏱️ Duration: ${Math.round(report.duration / 1000 / 60)} minutes`);
    console.log(`✅ Success Rate: ${(report.successRate * 100).toFixed(1)}%`);
    
    console.log('\n💰 COST BREAKDOWN');
    console.log('-'.repeat(20));
    console.log(`Total Cost: $${report.totalCost.toFixed(4)}`);
    console.log(`Total Tokens: ${report.totalTokens.toLocaleString()}`);
    
    console.log('\n🤖 AGENT PERFORMANCE');
    console.log('-'.repeat(20));
    report.agentMetrics.forEach(metric => {
      console.log(`${metric.agent}: ${metric.completed}/${metric.runs} runs, $${metric.totalCost.toFixed(4)}`);
    });
    
    console.log('\n📍 CHECKPOINTS');
    console.log('-'.repeat(20));
    console.log(`Created: ${report.checkpointsCreated} checkpoints`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS');
      console.log('-'.repeat(20));
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    console.log('='.repeat(60));
  }
}

// Supporting types
interface DevelopmentSessionOptions {
  model?: string;
  projectType?: string;
  specializations?: string[];
  autoSetupMCP?: boolean;
  createSystemPrompt?: boolean;
  cloudProvider?: 'aws' | 'azure' | 'gcp';
  environment?: Record<string, string>;
}

interface DevelopmentSession {
  sessionId: string;
  projectPath: string;
  goal: string;
  agents: Agent[];
  status: 'active' | 'paused' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  checkpoints: Checkpoint[];
  activities: WorkflowResult[];
}

interface WorkflowStep {
  name: string;
  type: 'analysis' | 'implementation' | 'review' | 'testing';
  description?: string;
  createCheckpoint?: boolean;
}

interface WorkflowResult {
  stepName: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  outputs: WorkflowOutput[];
  error?: string;
}

interface WorkflowOutput {
  type: 'agent_execution' | 'session_continuation' | 'code_review' | 'file_operation';
  agentName?: string;
  runId?: number;
  sessionId?: string;
  description: string;
  data?: any;
}

interface SessionReport {
  session: DevelopmentSession;
  duration: number;
  completedActivities: number;
  totalActivities: number;
  checkpointsCreated: number;
  agentMetrics: Array<{
    agent: string;
    runs: number;
    completed: number;
    totalCost: number;
    totalTokens: number;
  }>;
  totalCost: number;
  totalTokens: number;
  successRate: number;
  recommendations: string[];
}

// Usage
const assistant = new ClaudeDevelopmentAssistant();

const session = await assistant.startDevelopmentSession(
  '/path/to/my/project',
  'implement user authentication with JWT tokens',
  {
    projectType: 'web-api',
    specializations: ['security', 'testing'],
    cloudProvider: 'aws'
  }
);

// Execute workflow steps
await assistant.executeWorkflowStep(session, {
  name: 'Security Analysis',
  type: 'analysis',
  description: 'Analyze current security posture before implementing authentication'
});

await assistant.executeWorkflowStep(session, {
  name: 'Implement JWT Auth',
  type: 'implementation', 
  description: 'Implement JWT-based authentication system',
  createCheckpoint: true
});

await assistant.executeWorkflowStep(session, {
  name: 'Security Review',
  type: 'review',
  description: 'Review implemented authentication for security vulnerabilities'
});

await assistant.executeWorkflowStep(session, {
  name: 'Generate Tests',
  type: 'testing',
  description: 'Create comprehensive tests for authentication system'
});

// Generate final report
const report = await assistant.generateSessionReport(session);
```

This comprehensive examples document provides practical, real-world usage patterns for the Claudia API. Each example builds on the previous concepts and demonstrates how to combine different API features to create powerful development workflows.
