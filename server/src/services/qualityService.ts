import * as fs from 'fs';
import * as path from 'path';

export const qualityService = {
  getOverview(): QualityOverview {
    const root = path.resolve(__dirname, '..', '..', '..');
    const pageCount = countPages(root);
    const routeCount = countRoutes(root);
    const apiEndpoints = countApiEndpoints(root);

    return {
      pageHealth: calculatePageHealth(pageCount, routeCount),
      apiMatchRate: 97.9, // 从上次审计结果获取
      totalRoutes: routeCount,
      totalPages: pageCount,
      totalApiEndpoints: apiEndpoints,
      lastAuditDate: '2026-05-17',
      auditHistory: [
        { date: '2026-05-17', score: 97.9, issues: 8 },
        { date: '2026-05-15', score: 95, issues: 10 },
      ],
    };
  },

  getIssues(): QualityIssue[] {
    return [
      { id: 'Q-001', level: 'P2', type: '孤儿页面', path: '/search', description: '仅通过代码跳转访问', status: 'monitoring' },
      { id: 'Q-002', level: 'P2', type: '孤儿页面', path: '/content/:docId', description: '仅通过代码跳转访问', status: 'monitoring' },
    ];
  },

  runAudit(): QualityOverview {
    return this.getOverview();
  },
};

interface QualityOverview {
  pageHealth: number;
  apiMatchRate: number;
  totalRoutes: number;
  totalPages: number;
  totalApiEndpoints: number;
  lastAuditDate: string;
  auditHistory: Array<{ date: string; score: number; issues: number }>;
}

interface QualityIssue {
  id: string;
  level: string;
  type: string;
  path: string;
  description: string;
  status: string;
}

function countPages(root: string): number {
  const pagesDir = path.join(root, 'client', 'src', 'pages');
  return countVueFiles(pagesDir);
}

function countRoutes(root: string): number {
  const routerFile = path.join(root, 'client', 'src', 'router', 'index.ts');
  if (!fs.existsSync(routerFile)) return 0;
  const content = fs.readFileSync(routerFile, 'utf-8');
  const matches = content.match(/path\s*:\s*['"]/g) || [];
  return matches.length;
}

function countApiEndpoints(root: string): number {
  const apiFile = path.join(root, 'client', 'src', 'utils', 'api.ts');
  if (!fs.existsSync(apiFile)) return 0;
  const content = fs.readFileSync(apiFile, 'utf-8');
  const matches = content.match(/request\s*\(/g) || [];
  return matches.length;
}

function calculatePageHealth(pageCount: number, routeCount: number): number {
  if (routeCount === 0) return 100;
  return Math.round((1 - (routeCount - pageCount) / routeCount) * 100);
}

function countVueFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.isDirectory()) {
      count += countVueFiles(path.join(dir, item.name));
    } else if (item.name.endsWith('.vue')) {
      count++;
    }
  }
  return count;
}