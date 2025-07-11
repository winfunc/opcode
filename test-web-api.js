#!/usr/bin/env node

// Simple API endpoint tester for Claudia Web Server

const API_BASE = process.env.API_BASE || 'http://localhost:8080/api';

const endpoints = [
  { method: 'GET', path: '/health', name: 'Health Check' },
  { method: 'GET', path: '/projects', name: 'List Projects' },
  { method: 'GET', path: '/agents', name: 'List Agents' },
  { method: 'GET', path: '/mcp/servers', name: 'List MCP Servers' },
  { method: 'GET', path: '/slash-commands', name: 'List Slash Commands' },
  { method: 'GET', path: '/usage/stats', name: 'Usage Statistics' },
  { method: 'GET', path: '/running-sessions', name: 'Running Sessions' },
  { method: 'GET', path: '/running-claude-sessions', name: 'Running Claude Sessions' },
];

async function testEndpoint(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();
    
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: response.status,
      success: response.ok,
      dataType: isJson ? 'JSON' : 'TEXT',
      sampleData: isJson ? JSON.stringify(data).substring(0, 100) + '...' : data.substring(0, 100)
    };
  } catch (error) {
    return {
      name: endpoint.name,
      path: endpoint.path,
      status: 'ERROR',
      success: false,
      error: error.message
    };
  }
}

async function runTests() {
  console.log(`Testing API endpoints at: ${API_BASE}\n`);
  
  const results = [];
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.name} (${result.path})`);
    console.log(`   Status: ${result.status}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    } else if (result.success) {
      console.log(`   Data: ${result.sampleData}`);
    }
    console.log();
  }
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`\nSummary: ${successful}/${results.length} endpoints working`);
  if (failed > 0) {
    console.log(`Failed endpoints:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.name} (${r.path}): ${r.error || `HTTP ${r.status}`}`);
    });
  }
}

runTests().catch(console.error);