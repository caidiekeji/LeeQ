function s(n,o="info",t=2500){const e=document.createElement("div");e.className=`toast toast-${o}`,e.textContent=n,document.body.appendChild(e),setTimeout(()=>{e.style.opacity="0",e.style.transform="translateX(100%)",e.style.transition="opacity 0.3s, transform 0.3s",setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},300)},t)}const a=n=>s(n,"success"),i=n=>s(n,"error");function c(n){return new Promise(o=>{const t=document.createElement("div");t.className="modal-overlay",t.style.zIndex="200",t.innerHTML=`
      <div class="modal" style="min-width:360px; padding:24px; text-align:center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2" style="margin-bottom:12px;">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="margin-bottom:20px;font-size:14px;color:var(--text);">${n}</p>
        <div class="modal-actions" style="justify-content:center;">
          <button class="btn cancel-btn">取消</button>
          <button class="btn btn-danger confirm-btn">确认</button>
        </div>
      </div>
    `,document.body.appendChild(t),t.querySelector(".cancel-btn").addEventListener("click",()=>{document.body.removeChild(t),o(!1)}),t.querySelector(".confirm-btn").addEventListener("click",()=>{document.body.removeChild(t),o(!0)}),t.addEventListener("click",e=>{e.target===t&&(document.body.removeChild(t),o(!1))})})}export{i as a,c as s,a as t};
