import MarkdownIt from 'markdown-it';

export const md = new MarkdownIt({ html: false, breaks: true, linkify: true });

let mermaidReady = false;

export function renderMarkdown(content: string) {
  let html = md.render(content);
  if (/<code class="language-mermaid">/.test(html)) {
    html = html.replace(
      /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g,
      (_match: string, code: string) => {
        const decoded = code
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');
        const encodedCode = encodeURIComponent(decoded);
        return `<div class="mermaid-wrapper" data-code="${encodedCode}"><div class="mermaid">${decoded}</div><div class="mermaid-actions"><button class="mermaid-copy-btn" onclick="window.__copyMermaidCode(this)" title="复制代码"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div>`;
      }
    );
  }
  html = html.replace(
    /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (_match: string, lang: string, code: string) => {
      const language = lang || 'text';
      const decoded = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      const encoded = encodeURIComponent(decoded);
      return `<div class="code-block-wrapper" data-code="${encoded}" data-lang="${language}"><div class="code-block-header"><span class="code-lang-tag">${language}</span><div class="code-block-actions"><button class="code-copy-btn" onclick="window.__copyCodeBlock(this)" title="复制代码"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button></div></div><pre><code class="language-${language}">${decoded}</code></pre></div>`;
    }
  );
  return html;
}

export function runMermaid(el: HTMLElement) {
  const merEls = el.querySelectorAll('.mermaid:not(.mermaid-initialized)');
  if (merEls.length === 0) return;
  const doRun = (m: any) => {
    merEls.forEach(el => el.classList.add('mermaid-initialized'));
    m.default.run({ nodes: Array.from(merEls) as HTMLElement[] });
  };
  if (mermaidReady) {
    import('mermaid').then(doRun);
  } else {
    import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        theme: 'default' as const,
        securityLevel: 'sandbox' as const,
      });
      mermaidReady = true;
      doRun(m);
    });
  }
}

// 安全复制到剪贴板（兼容新旧 API）
async function safeCopyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard 不可用时回退到 execCommand
    return fallbackCopy(text);
  }
}

// execCommand 回退方案（兼容 HTTP 和旧浏览器）
function fallbackCopy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyToClipboard(text: string) {
  const plainText = text.replace(/<[^>]*>/g, '');
  try {
    await safeCopyToClipboard(plainText);
  } catch {
    // 复制失败，静默处理
  }
}

// 全局复制函数
if (typeof window !== 'undefined') {
  (window as any).__copyCodeBlock = function(btn: HTMLElement) {
    const wrapper = btn.closest('.code-block-wrapper') as HTMLElement;
    if (!wrapper) return;
    const code = decodeURIComponent(wrapper.dataset.code || '');
    safeCopyToClipboard(code).then((ok) => {
      if (!ok) return;
      const icon = btn.querySelector('svg');
      if (icon) {
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        setTimeout(() => {
          icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
        }, 1500);
      }
    });
  };

  (window as any).__copyMermaidCode = function(btn: HTMLElement) {
    const wrapper = btn.closest('.mermaid-wrapper') as HTMLElement;
    if (!wrapper) return;
    const code = decodeURIComponent(wrapper.dataset.code || '');
    safeCopyToClipboard(code).then((ok) => {
      if (!ok) return;
      const icon = btn.querySelector('svg');
      if (icon) {
        icon.innerHTML = '<polyline points="20 6 9 17 4 12"/>';
        setTimeout(() => {
          icon.innerHTML = '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>';
        }, 1500);
      }
    });
  };
}
