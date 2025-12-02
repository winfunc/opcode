#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Translation mapping suggestions
const translationMap = {
  // Agents.tsx
  'Agents': '代理',
  'Manage your CC agents': '管理您的 CC 代理',
  'Import': '导入',
  'From File': '从文件',
  'From GitHub': '从 GitHub',
  'Create Agent': '创建代理',
  'Delete Agent': '删除代理',
  'Are you sure you want to delete': '确定要删除',
  'Delete': '删除',
  'Cancel': '取消',
  
  // AgentRunOutputViewer.tsx
  'Agent Output': '代理输出',
  'Copy Output': '复制输出',
  'No output': '无输出',
  'Loading...': '加载中...',
  'Error': '错误',
  'Failed to load output': '加载输出失败',
  
  // SlashCommandPicker.tsx
  'Slash Commands': '斜杠命令',
  'No commands found': '未找到命令',
  'Search commands': '搜索命令',
  
  // ExecutionControlBar.tsx
  'Stop': '停止',
  'Execute': '执行',
  'Executing...': '执行中...',
  'Copy': '复制',
  'Copied!': '已复制！',
  
  // Common UI patterns
  'Filter': '筛选',
  'Sort': '排序',
  'Search': '搜索',
  'Clear': '清空',
  'Reset': '重置',
  'Save': '保存',
  'Edit': '编辑',
  'View': '查看',
  'Back': '返回',
  'Next': '下一步',
  'Previous': '上一步',
  'Close': '关闭',
  'Open': '打开',
  'Settings': '设置',
  'Help': '帮助',
  'About': '关于',
  'Language': '语言',
  'Theme': '主题',
  'Dark': '暗色',
  'Light': '亮色',
  'Loading': '加载中',
  'Success': '成功',
  'Warning': '警告',
  'Info': '信息',
  'Confirm': '确认',
  'Yes': '是',
  'No': '否',
  'OK': '确定',
  'Apply': '应用',
  'Discard': '丢弃',
  'Try again': '重试',
  'Something went wrong': '出错了',
};

// P3 components to analyze
const p3Components = [
  'Agents.tsx',
  'AgentRunOutputViewer.tsx',
  'SlashCommandPicker.tsx',
  'ExecutionControlBar.tsx',
  'AgentsModal.tsx',
];

const componentDir = '/c/Users/zhu/opcode/src/components';

console.log('📊 Analyzing P3 Components for Translation\n');

let allTranslations = {};

p3Components.forEach(component => {
  const filepath = path.join(componentDir, component);
  
  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  ${component} not found`);
    return;
  }
  
  const content = fs.readFileSync(filepath, 'utf-8');
  const componentTranslations = {};
  
  // Find common UI patterns
  Object.keys(translationMap).forEach(english => {
    const regex = new RegExp(`["']${english}["']`, 'g');
    if (regex.test(content)) {
      const key = english
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
      componentTranslations[key] = translationMap[english];
    }
  });
  
  if (Object.keys(componentTranslations).length > 0) {
    allTranslations[component.replace('.tsx', '')] = componentTranslations;
    console.log(`✅ ${component}: Found ${Object.keys(componentTranslations).length} translatable strings`);
  }
});

console.log('\n📝 Translation Summary:');
console.log(JSON.stringify(allTranslations, null, 2));

// Write to file
fs.writeFileSync('/tmp/p3_translations.json', JSON.stringify(allTranslations, null, 2));
console.log('\n✅ Translations saved to /tmp/p3_translations.json');

