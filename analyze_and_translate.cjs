#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Translation mapping suggestions
const translationMap = {
  // Common UI patterns
  'Agents': '代理',
  'Manage': '管理',
  'Import': '导入',
  'From File': '从文件',
  'From GitHub': '从 GitHub',
  'Create': '创建',
  'Delete': '删除',
  'Edit': '编辑',
  'View': '查看',
  'Cancel': '取消',
  'Save': '保存',
  'Copy': '复制',
  'Search': '搜索',
  'Filter': '筛选',
  'Sort': '排序',
  'Loading': '加载中',
  'Loading...': '加载中...',
  'Success': '成功',
  'Error': '错误',
  'Warning': '警告',
  'Info': '信息',
  'Stop': '停止',
  'Execute': '执行',
  'Close': '关闭',
  'Back': '返回',
  'Help': '帮助',
  'Settings': '设置',
};

// P3 components to analyze
const p3Components = [
  'Agents.tsx',
  'AgentRunOutputViewer.tsx',
  'SlashCommandPicker.tsx',
  'ExecutionControlBar.tsx',
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
    if (content.includes(`"${english}"`) || content.includes(`'${english}'`)) {
      const key = english
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
      componentTranslations[key] = translationMap[english];
    }
  });
  
  if (Object.keys(componentTranslations).length > 0) {
    allTranslations[component.replace('.tsx', '')] = componentTranslations;
    console.log(`✅ ${component}: Found ${Object.keys(componentTranslations).length} strings`);
  }
});

console.log('\n📝 Translation Summary:');
const summary = {};
for (const [comp, trans] of Object.entries(allTranslations)) {
  summary[comp] = Object.keys(trans).length;
}
console.log(JSON.stringify(summary, null, 2));

// Write to file
fs.writeFileSync('/tmp/p3_translations.json', JSON.stringify(allTranslations, null, 2));
console.log('\n✅ Translations saved to /tmp/p3_translations.json');

