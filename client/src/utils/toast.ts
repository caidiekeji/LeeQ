/**
 * Toast 轻提示工具
 * 用于替代浏览器原生 alert()，提供统一的消息反馈样式
 */

type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * 创建并显示Toast提示
 * @param message 提示文本
 * @param type 提示类型（默认 info）
 * @param duration 显示时长ms（默认 2500）
 */
function showToast(message: string, type: ToastType = 'info', duration = 2500) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'opacity 0.3s, transform 0.3s';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

/** 成功Toast */
export const toastSuccess = (msg: string) => showToast(msg, 'success');

/** 错误Toast */
export const toastError = (msg: string) => showToast(msg, 'error');

/** 警告Toast */
export const toastWarning = (msg: string) => showToast(msg, 'warning');

/** 信息Toast */
export const toastInfo = (msg: string) => showToast(msg, 'info');

/**
 * 自定义确认弹窗，替代浏览器原生 confirm()
 * @param message 提示文本
 * @returns Promise<boolean>
 */
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '200';

    overlay.innerHTML = `
      <div class="modal" style="min-width:360px; padding:24px; text-align:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="margin-bottom:12px;">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="margin-bottom:20px;font-size:14px;color:var(--text);">${message}</p>
        <div class="modal-actions" style="justify-content:center;">
          <button class="btn cancel-btn">取消</button>
          <button class="btn btn-danger confirm-btn">确认</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('.cancel-btn')!.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(false);
    });
    overlay.querySelector('.confirm-btn')!.addEventListener('click', () => {
      document.body.removeChild(overlay);
      resolve(true);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
        resolve(false);
      }
    });
  });
}
