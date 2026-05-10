// Firebase 設定 + 共用 helper
// 改班級代號只需改下面 CLASS_NAME 一處

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getFirestore, addDoc, collection, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCTLhRf7jcJH_AwUzbV4MawkrKNPrIVG5Y',
  authDomain: 'my-teaching-tools-517a0.firebaseapp.com',
  projectId: 'my-teaching-tools-517a0',
  storageBucket: 'my-teaching-tools-517a0.firebasestorage.app',
  messagingSenderId: '244288457011',
  appId: '1:244288457011:web:4b3ff8a846a6c50b169646',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 老師可改 ===
export const CLASS_NAME = '114_2_食品營養華語文獻閱讀與寫作';
export const COLLECTION = 'glp1_answers';

// === 學號管理（用 localStorage，跨 4 個遊戲共享） ===
const SID_KEY = 'glp1_student_id';

export function getStudentId() {
  return localStorage.getItem(SID_KEY) || null;
}

export function setStudentId(id) {
  localStorage.setItem(SID_KEY, id);
}

export function clearStudentId() {
  localStorage.removeItem(SID_KEY);
}

// === 寫一筆事件到 Firestore ===
// data: { game, event_type, question_id?, is_correct?, attempts?, final_score? }
export async function logEvent(data) {
  const studentId = getStudentId();
  if (!studentId) {
    console.warn('No student_id; skipping log');
    return;
  }
  try {
    await addDoc(collection(db, COLLECTION), {
      student_id: studentId,
      class_name: CLASS_NAME,
      game: data.game,
      event_type: data.event_type,
      question_id: data.question_id || null,
      is_correct: data.is_correct === undefined ? null : data.is_correct,
      attempts: data.attempts === undefined ? null : data.attempts,
      final_score: data.final_score === undefined ? null : data.final_score,
      user_agent: (navigator.userAgent || '').slice(0, 200),
      timestamp: serverTimestamp(),
    });
  } catch (e) {
    console.error('Firestore write failed:', e);
  }
}

// === 學號輸入彈窗 UI（共用） ===
// 自動注入 CSS 與 modal HTML，呼叫 ensureStudentId() 取得學號
let modalCssInjected = false;

function injectModalCss() {
  if (modalCssInjected) return;
  modalCssInjected = true;
  const css = `
    .sid-overlay {
      position: fixed; inset: 0;
      background: rgba(34, 52, 74, 0.85);
      display: none; align-items: center; justify-content: center;
      z-index: 1000; padding: 20px;
      font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
    }
    .sid-overlay.show { display: flex; }
    .sid-card {
      background: white; border-radius: 14px; max-width: 420px; width: 100%;
      padding: 28px 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.3);
    }
    .sid-card h2 { font-size: 20px; margin-bottom: 8px; color: #22344A; }
    .sid-card .sid-hint { font-size: 13px; color: #5B6777; margin-bottom: 16px; line-height: 1.5; }
    .sid-card input {
      width: 100%; padding: 12px 14px; border: 2px solid #D9E1E8;
      border-radius: 8px; font-size: 18px; font-family: inherit;
      outline: none; transition: border-color 0.2s;
    }
    .sid-card input:focus { border-color: #D96A3B; }
    .sid-card .sid-error { color: #C8553D; font-size: 13px; margin-top: 8px; min-height: 18px; }
    .sid-card .sid-actions { margin-top: 16px; text-align: right; }
    .sid-card button {
      background: #D96A3B; color: white; border: none;
      padding: 10px 22px; border-radius: 8px;
      font-size: 15px; font-weight: bold; cursor: pointer; font-family: inherit;
      min-height: 44px;
    }
    .sid-card button:hover { background: #B85530; }
    .sid-pill {
      position: fixed; top: 12px; right: 12px;
      background: #22344A; color: white;
      padding: 6px 12px; border-radius: 20px;
      font-size: 12px; z-index: 50;
      font-family: 'Microsoft JhengHei', 'PingFang TC', sans-serif;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .sid-pill .sid-change {
      margin-left: 8px; color: #F5EEE6;
      text-decoration: underline; cursor: pointer; font-size: 11px;
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}

function injectModalHtml() {
  const div = document.createElement('div');
  div.className = 'sid-overlay';
  div.id = 'sid-overlay';
  div.innerHTML = `
    <div class="sid-card">
      <h2>📝 請輸入學號</h2>
      <div class="sid-hint">學號用來記錄你的答題狀況。下次玩同一系列遊戲不需重新輸入。</div>
      <input id="sid-input" type="text" inputmode="text" autocomplete="off" placeholder="例如：A1234567" maxlength="20">
      <div class="sid-error" id="sid-error"></div>
      <div class="sid-actions">
        <button id="sid-confirm">確認</button>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  return div;
}

function injectPill(studentId) {
  let pill = document.getElementById('sid-pill');
  if (!pill) {
    pill = document.createElement('div');
    pill.className = 'sid-pill';
    pill.id = 'sid-pill';
    document.body.appendChild(pill);
  }
  pill.innerHTML = `🎓 ${studentId} <span class="sid-change" id="sid-change">更換</span>`;
  document.getElementById('sid-change').onclick = async () => {
    clearStudentId();
    pill.remove();
    await ensureStudentId();
    location.reload();
  };
}

// 主要 API：保證有學號，沒有就跳 modal 等使用者輸入
export function ensureStudentId() {
  injectModalCss();
  return new Promise((resolve) => {
    const existing = getStudentId();
    if (existing) {
      injectPill(existing);
      resolve(existing);
      return;
    }
    const overlay = injectModalHtml();
    overlay.classList.add('show');
    const input = document.getElementById('sid-input');
    const err = document.getElementById('sid-error');
    const btn = document.getElementById('sid-confirm');
    setTimeout(() => input.focus(), 100);

    function submit() {
      const val = input.value.trim();
      if (val.length < 1) { err.textContent = '請輸入學號。'; return; }
      if (val.length > 20) { err.textContent = '學號太長（≤20 字）。'; return; }
      if (!/^[A-Za-z0-9_\-]+$/.test(val)) {
        err.textContent = '學號只能用英文、數字、底線、連字號。';
        return;
      }
      setStudentId(val);
      overlay.classList.remove('show');
      overlay.remove();
      injectPill(val);
      resolve(val);
    }

    btn.onclick = submit;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
  });
}
