/**
 * CrewAI Manager Component for Claudia
 * Integrates with BRNESTRM CrewAI Backend (port 8000)
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CrewAIAgent {
  id: string;
  role: string;
  goal: string;
  backstory: string;
  tools: string[];
  status: 'active' | 'idle' | 'busy';
}

interface CrewAITask {
  task_id: string;
  agent_id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  timestamp: string;
}

interface CrewAIHealth {
  status: string;
  service: string;
  version: string;
  agents: number;
  crews: number;
}

export function CrewAIManager() {
  const [health, setHealth] = useState<CrewAIHealth | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [tasks, setTasks] = useState<CrewAITask[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Task execution state
  const [selectedAgent, setSelectedAgent] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');

  const CREWAI_BASE_URL = 'http://localhost:8000';

  // Agent metadata mapping
  const agentMetadata: Record<string, Partial<CrewAIAgent>> = {
    'idea-generator-001': {
      role: '아이디어 생성자',
      goal: 'dorandoran.link 방문자들의 경험과 니즈를 분석하여 혁신적인 아이디어를 생성',
      tools: ['web_scraping']
    },
    'brainstormer-001': {
      role: '브레인스토머', 
      goal: 'dorandoran.link에서 수집된 아이디어들을 체계적으로 분석하고 실현 가능한 프로젝트로 발전',
      tools: ['idea_analysis']
    },
    'jinseomi-filter-001': {
      role: '진선미 필터',
      goal: '모든 프로젝트가 진선미(진실됨, 선함, 아름다움) 철학에 부합하도록 검증',
      tools: ['ethics_analysis']
    },
    'architect-001': {
      role: '시스템 아키텍트',
      goal: '브레인스토밍된 아이디어를 기술적으로 구현 가능한 시스템 아키텍처로 설계',
      tools: ['architecture_design']
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const response = await fetch(`${CREWAI_BASE_URL}/health`);
      if (response.ok) {
        const healthData = await response.json();
        setHealth(healthData);
        setIsConnected(true);
        await loadAgents();
      } else {
        setIsConnected(false);
      }
    } catch (error) {
      console.error('CrewAI connection failed:', error);
      setIsConnected(false);
    }
  };

  const loadAgents = async () => {
    try {
      const response = await fetch(`${CREWAI_BASE_URL}/agents`);
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const executeTask = async () => {
    if (!selectedAgent || !taskDescription) return;

    setLoading(true);
    const taskId = `task-${Date.now()}`;

    try {
      const response = await fetch(`${CREWAI_BASE_URL}/execute_crew_task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId,
          agent_id: selectedAgent,
          description: taskDescription,
          tools: agentMetadata[selectedAgent]?.tools || [],
          expected_output: expectedOutput || '분석 결과 및 추천사항'
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setTasks(prev => [result, ...prev]);
        setTaskDescription('');
        setExpectedOutput('');
        // Success toast would go here
      }
    } catch (error) {
      console.error('Task execution failed:', error);
      // Error toast would go here
    }

    setLoading(false);
  };

  const runEcosystemCycle = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${CREWAI_BASE_URL}/brnestrm/ecosystem_cycle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        // Add ecosystem cycle results to tasks
        const ecosystemTask: CrewAITask = {
          task_id: result.cycle_id,
          agent_id: 'ecosystem-cycle',
          description: 'BRNESTRM 생태계 순환 워크플로우',
          status: 'completed',
          result: result,
          timestamp: result.timestamp
        };
        setTasks(prev => [ecosystemTask, ...prev]);
      }
    } catch (error) {
      console.error('Ecosystem cycle failed:', error);
    }
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'completed': return 'bg-green-500';
      case 'running': case 'busy': return 'bg-yellow-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CrewAI Manager</h1>
          <p className="text-muted-foreground">BRNESTRM AI 에이전트 크루 관리</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getStatusColor(health?.status || 'unknown')}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button onClick={checkConnection} variant="outline" size="sm">
            새로고침
          </Button>
        </div>
      </div>

      {/* Health Status */}
      {health && (
        <Card>
          <CardHeader>
            <CardTitle>시스템 상태</CardTitle>
            <CardDescription>CrewAI Backend 연결 정보</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">서비스</div>
                <div className="font-semibold">{health.service}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">버전</div>
                <div className="font-semibold">{health.version}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">에이전트</div>
                <div className="font-semibold">{health.agents}개</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">크루</div>
                <div className="font-semibold">{health.crews}개</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs className="space-y-4" {...({} as any)}>
        <TabsList>
          <TabsTrigger value="agents">에이전트</TabsTrigger>
          <TabsTrigger value="execute">작업 실행</TabsTrigger>
          <TabsTrigger value="ecosystem">생태계 순환</TabsTrigger>
          <TabsTrigger value="history">작업 기록</TabsTrigger>
        </TabsList>

        {/* Agents Tab */}
        <TabsContent value="agents">
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agentId) => {
              const metadata = agentMetadata[agentId];
              return (
                <Card key={agentId}>
                  <CardHeader>
                    <CardTitle className="text-lg">{metadata?.role || agentId}</CardTitle>
                    <CardDescription>{agentId}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm mb-3">{metadata?.goal}</p>
                    <div className="flex flex-wrap gap-1">
                      {metadata?.tools?.map((tool) => (
                        <Badge key={tool} variant="secondary" className="text-xs">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Execute Tab */}
        <TabsContent value="execute">
          <Card>
            <CardHeader>
              <CardTitle>작업 실행</CardTitle>
              <CardDescription>CrewAI 에이전트에게 작업을 요청합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">에이전트 선택</label>
                <select 
                  value={selectedAgent} 
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-md"
                >
                  <option value="">에이전트를 선택하세요</option>
                  {agents.map((agentId) => (
                    <option key={agentId} value={agentId}>
                      {agentMetadata[agentId]?.role || agentId}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium">작업 설명</label>
                <Textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  placeholder="수행할 작업을 자세히 설명해주세요..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-sm font-medium">기대 결과 (선택사항)</label>
                <Input
                  value={expectedOutput}
                  onChange={(e) => setExpectedOutput(e.target.value)}
                  placeholder="예: 분석 결과 및 추천사항"
                  className="mt-1"
                />
              </div>

              <Button 
                onClick={executeTask} 
                disabled={!selectedAgent || !taskDescription || loading}
                className="w-full"
              >
                {loading ? '실행 중...' : '작업 실행'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ecosystem Tab */}
        <TabsContent value="ecosystem">
          <Card>
            <CardHeader>
              <CardTitle>BRNESTRM 생태계 순환</CardTitle>
              <CardDescription>
                dorandoran.link → 브레인스토밍 → 진선미 필터링 → 아키텍처 설계
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">생태계 순환 과정</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>아이디어 수집: dorandoran.link에서 사용자 니즈 분석</li>
                    <li>브레인스토밍: 수집된 아이디어를 실현 가능한 프로젝트로 발전</li>
                    <li>진선미 필터링: 진실됨, 선함, 아름다움 철학 부합성 검증</li>
                    <li>아키텍처 설계: Git-Native M4 아키텍처 기반 시스템 설계</li>
                  </ol>
                </div>
                
                <Button 
                  onClick={runEcosystemCycle} 
                  disabled={loading || !isConnected}
                  className="w-full"
                  size="lg"
                >
                  {loading ? '순환 실행 중...' : '🔄 생태계 순환 시작'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>작업 기록</CardTitle>
              <CardDescription>최근 실행된 CrewAI 작업들</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                {tasks.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    아직 실행된 작업이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {tasks.map((task) => (
                      <div key={task.task_id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold">{task.task_id}</div>
                          <Badge className={getStatusColor(task.status)}>
                            {task.status}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground mb-2">
                          Agent: {task.agent_id}
                        </div>
                        <div className="text-sm mb-2">{task.description}</div>
                        {task.result && (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground">
                              결과 보기
                            </summary>
                            <pre className="mt-2 bg-muted p-2 rounded overflow-auto">
                              {typeof task.result === 'string' 
                                ? task.result 
                                : JSON.stringify(task.result, null, 2)}
                            </pre>
                          </details>
                        )}
                        <div className="text-xs text-muted-foreground mt-2">
                          {new Date(task.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}