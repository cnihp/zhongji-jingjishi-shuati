
// ==================== State ====================
let allQuestions = [...questionBank];
let currentFilter = 'all';
let currentTab = 'practice';
let currentChapter = 'all';
let currentSection = 'all';
let currentIndex = 0;
let answeredState = {};
let wrongSet = new Set();
const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

// ==================== Helpers ====================
function getTypeLabel(q) {
  if (q.type === 'single') return '单选';
  if (q.type === 'multi') return '多选';
  return q.type;
}

function getFilteredQuestions() {
  let qs = allQuestions;
  if (currentTab === 'wrong') {
    qs = qs.filter(q => wrongSet.has(q.id));
  } else if (currentTab === 'chapter') {
    if (currentChapter !== 'all') {
      qs = qs.filter(q => q.chapter === currentChapter);
      if (currentSection !== 'all') qs = qs.filter(q => q.section === currentSection);
    }
  }
  if (currentFilter !== 'all') qs = qs.filter(q => q.type === currentFilter);
  return qs;
}

// ==================== Save / Load ====================
function saveState() {
  const data = { answeredState, wrongSet: [...wrongSet] };
  try { localStorage.setItem('examState', JSON.stringify(data)); } catch(e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem('examState');
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.answeredState) answeredState = data.answeredState;
    if (data.wrongSet) wrongSet = new Set(data.wrongSet);
  } catch(e) {}
}

// ==================== Render ====================
function render() {
  const qs = getFilteredQuestions();
  const totalEl = document.getElementById('totalQ');
  const doneEl = document.getElementById('doneQ');
  const correctEl = document.getElementById('correctQ');
  const rateEl = document.getElementById('rateQ');

  totalEl.textContent = allQuestions.length;
  const done = Object.values(answeredState).filter(s => s.submitted).length;
  const correct = Object.values(answeredState).filter(s => s.isCorrect).length;
  doneEl.textContent = done;
  correctEl.textContent = correct;
  rateEl.textContent = done ? Math.round(correct / done * 100) + '%' : '0%';

  const wrongCount = wrongSet.size;
  document.getElementById('wrongBadge').textContent = wrongCount;

  // Progress
  const filtered = getFilteredQuestions();
  const doneFiltered = filtered.filter(q => {
    const s = answeredState[q.id];
    return s && s.submitted;
  }).length;
  const pct = filtered.length ? Math.round(doneFiltered / filtered.length * 100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';

  if (qs.length === 0) {
    document.getElementById('qContent').innerHTML =
      '<div class="empty-state fade-in"><div class="icon">' +
      (currentTab === 'wrong' ? '🎉' : '📭') +
      '</div><p>' +
      (currentTab === 'wrong' ? '没有错题，继续保持！' : '暂无私题，请切换其他章节') +
      '</p></div>';
    return;
  }

  if (currentIndex >= qs.length) currentIndex = qs.length - 1;
  if (currentIndex < 0) currentIndex = 0;

  const q = qs[currentIndex];
  const state = answeredState[q.id];
  const submitted = state && state.submitted;
  const selected = state ? state.selected : [];

  let html = '<div class="fade-in">';

  // Meta
  html += '<div class="q-meta">';
  html += '<span class="q-number">#' + (currentIndex + 1) + ' / ' + qs.length + '</span>';
  html += '<span class="q-tag' + (q.type === 'multi' ? ' multi' : '') + '">' + getTypeLabel(q) + '</span>';
  html += '<span class="q-chapter">' + (q.chapter || '') + '</span>';
  html += '</div>';

  // Question text
  html += '<div class="q-text">' + q.text + '</div>';

  // Options
  html += '<div class="options">';
  for (let i = 0; i < q.options.length; i++) {
    let cls = 'opt';
    if (selected.includes(i)) cls += ' selected';
    if (submitted) {
      const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
      if (selected.includes(i) && correctAnswer.includes(i)) cls += ' correct';
      else if (selected.includes(i) && !correctAnswer.includes(i)) cls += ' wrong';
      else if (!selected.includes(i) && correctAnswer.includes(i)) cls += ' reveal-correct';
    }
    const letter = letters[i] || '';
    html += '<div class="' + cls + '" data-optidx="' + i + '">';
    html += '<span class="letter">' + letter + '</span>';
    html += '<span class="opt-text">' + q.options[i] + '</span>';
    html += '</div>';
  }
  html += '</div>';

  // Explanation
  if (submitted) {
    const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
    const correctStr = correctAnswer.map(i => letters[i]).join(', ');
    const isCorrect = state.isCorrect;
    html += '<div class="explanation show">';
    html += '<div class="label">' +
      (isCorrect ? '✅ 回答正确' : '❌ 回答错误') +
      ' · 正确答案：' + correctStr + '</div>';
    if (q.explanation) html += '<div>' + q.explanation + '</div>';
    html += '</div>';
  } else {
    html += '<div class="explanation" id="explBox"></div>';
  }

  html += '</div>';
  document.getElementById('qContent').innerHTML = html;

  // Buttons
  document.getElementById('prevBtn').disabled = (currentIndex === 0 || qs.length === 0);
  document.getElementById('nextBtn').disabled = (currentIndex >= qs.length - 1 || qs.length === 0);

  const subBtn = document.getElementById('submitBtn');
  const showBtn = document.getElementById('showAnsBtn');
  subBtn.disabled = submitted;
  if (submitted) subBtn.textContent = '✅ 已提交';
  else subBtn.textContent = (q.type === 'multi') ? '📋 提交答案' : '📋 提交答案';

  // Option click handlers
  document.querySelectorAll('.opt').forEach(el => {
    el.addEventListener('click', function() {
      if (submitted) return;
      const idx = parseInt(this.dataset.optidx);
      const qs2 = getFilteredQuestions();
      if (qs2.length === 0) return;
      const q2 = qs2[currentIndex];
      if (!answeredState[q2.id]) answeredState[q2.id] = { selected: [], submitted: false, isCorrect: false };
      const st = answeredState[q2.id];
      if (q2.type === 'single') {
        st.selected = [idx];
      } else {
        const pos = st.selected.indexOf(idx);
        if (pos >= 0) st.selected.splice(pos, 1);
        else st.selected.push(idx);
      }
      saveState();
      render();
    });
  });

  // Auto scroll to top of question card
  const card = document.getElementById('questionCard');
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==================== Actions ====================
// Submit
document.getElementById('submitBtn').addEventListener('click', function() {
  const qs = getFilteredQuestions();
  if (qs.length === 0) return;
  const q = qs[currentIndex];
  const state = answeredState[q.id];
  if (!state || state.selected.length === 0) {
    // Hint: select at least one option
    return;
  }
  state.submitted = true;
  const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
  const sortedSelected = [...state.selected].sort();
  const sortedCorrect = [...correctAnswer].sort();
  let isCorrect = false;
  if (q.type === 'single') {
    isCorrect = sortedSelected.length === 1 && sortedCorrect.length === 1 && sortedSelected[0] === sortedCorrect[0];
  } else {
    isCorrect = sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every((v, i) => v === sortedCorrect[i]);
  }
  state.isCorrect = isCorrect;
  if (!isCorrect && currentTab !== 'wrong') wrongSet.add(q.id);
  else if (isCorrect) wrongSet.delete(q.id);
  saveState();
  render();
});

// Show Answer
document.getElementById('showAnsBtn').addEventListener('click', function() {
  const qs = getFilteredQuestions();
  if (qs.length === 0) return;
  const q = qs[currentIndex];
  const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
  const correctStr = correctAnswer.map(i => letters[i]).join(', ');

  // Select the correct answers
  if (!answeredState[q.id]) {
    answeredState[q.id] = { selected: [...correctAnswer], submitted: false, isCorrect: true };
  } else {
    const st = answeredState[q.id];
    st.selected = [...correctAnswer];
    st.submitted = false;
  }
  saveState();

  // Show explanation
  const explBox = document.querySelector('.explanation');
  if (explBox) {
    explBox.classList.add('show');
    explBox.innerHTML = '<div class="label">📝 参考答案：' + correctStr + '</div>' +
      (q.explanation ? '<div>' + q.explanation + '</div>' : '');
  }

  // Also reveal options visually (by re-rendering with submitted=true on the state)
  const st = answeredState[q.id];
  st.submitted = true;
  const correctAnswer2 = Array.isArray(q.answer) ? q.answer : [q.answer];
  const sortedSelected = [...st.selected].sort();
  const sortedCorrect = [...correctAnswer2].sort();
  let isCorrect = false;
  if (q.type === 'single') {
    isCorrect = sortedSelected.length === 1 && sortedCorrect.length === 1 && sortedSelected[0] === sortedCorrect[0];
  } else {
    isCorrect = sortedSelected.length === sortedCorrect.length &&
      sortedSelected.every((v, i) => v === sortedCorrect[i]);
  }
  st.isCorrect = isCorrect;
  saveState();
  render();
});

// Prev / Next
document.getElementById('prevBtn').addEventListener('click', function() {
  if (currentIndex > 0) { currentIndex--; render(); }
});
document.getElementById('nextBtn').addEventListener('click', function() {
  const qs = getFilteredQuestions();
  if (currentIndex < qs.length - 1) { currentIndex++; render(); }
});

// Reset
document.getElementById('resetBtn').addEventListener('click', function() {
  if (!confirm('确定重置所有答题记录？')) return;
  answeredState = {};
  wrongSet = new Set();
  currentIndex = 0;
  saveState();
  render();
});

// ==================== Chapter / Section Buttons ====================
// Chinese number to integer
const chnNum = {"零":0,"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"八":8,"九":9,"十":10,"十一":11,"十二":12,"十三":13,"十四":14,"十五":15,"十六":16,"十七":17,"十八":18,"十九":19,"二十":20,"二十一":21,"二十二":22,"二十三":23,"二十四":24,"二十五":25,"二十六":26,"二十七":27,"二十八":28,"二十九":29,"三十":30,"三十一":31,"三十二":32,"三十三":33,"三十四":34,"三十五":35,"三十六":36,"三十七":37,"三十八":38,"三十九":39,"四十":40};
function chToNum(s) { const m = s.match(/[零一二三四五六七八九十]+/); return m ? (chnNum[m[0]] || 99) : 99; }function buildChapterButtons() {
  const chSet = new Set();
  allQuestions.forEach(q => { if (q.chapter) chSet.add(q.chapter); });
  const container = document.getElementById("chapterBtns");
  if (!container) return;

  // Sort chapters by numeric value
  const chList = Array.from(chSet).sort((a, b) => {
    const na = chToNum(a), nb = chToNum(b);
    if (na !== nb) return na - nb;
    const ma = a.match(/\d+$/), mb = b.match(/\d+$/);
    if (ma && mb) return parseInt(ma[0]) - parseInt(mb[0]);
    return a.localeCompare(b);
  });

  let html = "<button class=\"chip active-all\" data-chapter=\"all\">\U0001f4c2 全部章节</button>";
  chList.forEach(ch => {
    const num = chToNum(ch);
    if (num === 1) html += "<button class=\"chip part-label\">\U0001f4ca 经济学基础（第1-10章）</button>";
    else if (num === 11) html += "<button class=\"chip part-label\">\U0001f4b0 财政（第11-16章）</button>";
    else if (num === 17) html += "<button class=\"chip part-label\">\U0001f3e6 货币与金融（第17-22章）</button>";
    else if (num === 23) html += "<button class=\"chip part-label\">\U0001f4c8 统计（第23-27章）</button>";
    else if (num === 28) html += "<button class=\"chip part-label\">\U0001f4cb 会计（第28-32章）</button>";
    else if (num === 33) html += "<button class=\"chip part-label\">\u2696\ufe0f 法律（第33-37章）</button>";
    else if (num === 99) html += "<button class=\"chip part-label\">\U0001f4dd 模拟试卷</button>";
    html += "<button class=\"chip\" data-chapter=\"" + ch.replace(/'/g, "\\'") + "\">" + ch + "</button>";
  });

  container.innerHTML = html;
  container.querySelectorAll(".chip[data-chapter]").forEach(btn => {
    btn.addEventListener("click", function() {
      container.querySelectorAll(".chip").forEach(b => b.classList.remove("active"));
      this.classList.add("active");
      currentChapter = this.dataset.chapter;
      currentSection = "all";
      currentIndex = 0;
      buildSectionButtons(currentChapter);
      render();
    });
  });
}
function buildSectionButtons(chapterName) {
  const secSet = new Set();
  allQuestions.forEach(q => { if (q.chapter === chapterName && q.section) secSet.add(q.section); });
  const container = document.getElementById('sectionBtns');
  const bar = document.getElementById('sectionBar');
  if (!container) return;
  if (secSet.size === 0) { bar.style.display = 'none'; return; }
  let html = '<button class="chip active-all" data-section="all">📂 全部</button>';
  Array.from(secSet).sort().forEach(sec => {
    html += '<button class="chip" data-section="' + sec.replace(/'/g, "\\'") + '">' + sec + '</button>';
  });
  container.innerHTML = html;
  bar.style.display = 'block';
  container.querySelectorAll('.chip[data-section]').forEach(btn => {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.chip').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentSection = this.dataset.section;
      currentIndex = 0;
      render();
    });
  });
}

// ==================== Tab Switching ====================
document.getElementById('tabBar').querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentTab = this.dataset.tab;
    currentIndex = 0;

    const chSection = document.getElementById('chapterSection');
    const modePills = document.getElementById('modePills');
    if (currentTab === 'chapter') {
      chSection.style.display = 'block';
      modePills.style.display = 'none';
      document.getElementById('sectionBar').style.display = 'none';
      currentSection = 'all';
      buildChapterButtons();
    } else {
      chSection.style.display = 'none';
      modePills.style.display = 'flex';
    }

    // Exam mode: hide mode pills, use different submit logic
    if (currentTab === 'exam') {
      modePills.style.display = 'none';
    }

    render();
  });
});

// ==================== Mode Pills ====================
document.getElementById('modePills').querySelectorAll('.pill-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (currentTab === 'wrong' || currentTab === 'exam') return;
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.mode;
    currentIndex = 0;
    render();
  });
});

// ==================== Keyboard Shortcuts ====================
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowLeft' || e.key === 'a') {
    const btn = document.getElementById('prevBtn');
    if (!btn.disabled) { currentIndex--; render(); }
  } else if (e.key === 'ArrowRight' || e.key === 'd') {
    const btn = document.getElementById('nextBtn');
    if (!btn.disabled) { currentIndex++; render(); }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    if (!btn.disabled) btn.click();
  } else if (e.key === 's') {
    document.getElementById('showAnsBtn').click();
  }
});


// ==================== User Login System ====================
let currentUser = null;
const STORAGE_PREFIX = 'examState_';

function getStorageKey() { return STORAGE_PREFIX + currentUser; }

function getSavedUsers() {
  try { return JSON.parse(localStorage.getItem('examUsers') || '[]'); } catch(e) { return []; }
}
function saveUserList(users) {
  try { localStorage.setItem('examUsers', JSON.stringify(users)); } catch(e) {}
}

function showLoginModal() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginInput').value = '';
  document.getElementById('loginInput').focus();
  const users = getSavedUsers();
  const list = document.getElementById('userList');
  if (users.length > 0) {
    let html = '<p>已有用户，点击切换：</p>';
    users.forEach(function(u) {
      html += '<button class="user-btn" data-username="' + u.replace(/'/g, '') + '">' + u + '</button>';
    });
    list.innerHTML = html;
    list.style.display = 'block';
  } else {
    list.style.display = 'none';
  }
}function hideLoginModal() {
  document.getElementById('loginOverlay').style.display = 'none';
}

function doLogin() {
  const name = document.getElementById('loginInput').value.trim();
  if (!name) { alert('请输入昵称'); return; }
  loginAs(name);
}

function loginAs(name) {
  currentUser = name;
  // Save to user list
  const users = getSavedUsers();
  if (!users.includes(name)) {
    users.push(name);
    saveUserList(users);
  }
  // Load user data
  loadState();
  hideLoginModal();
  document.getElementById('userNameDisplay').textContent = currentUser;
  render();
}

function logoutUser() {
  currentUser = null;
  document.getElementById('userDropdown').classList.remove('show');
  // Reset everything
  answeredState = {};
  wrongSet = new Set();
  currentIndex = 0;
  showLoginModal();
  render();
}

function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  dd.classList.toggle('show');
}

// Close dropdown on click outside
document.addEventListener('click', function(e) {
  const badge = document.getElementById('userBadge');
  if (badge && !badge.contains(e.target)) {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('show');
  }
});

// Override save/load to use user-specific keys
const _origSaveState = saveState;
const _origLoadState = loadState;

saveState = function() {
  if (!currentUser) return;
  const data = { answeredState, wrongSet: [...wrongSet] };
  try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch(e) {}
};

loadState = function() {
  answeredState = {};
  wrongSet = new Set();
  if (!currentUser) return;
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.answeredState) answeredState = data.answeredState;
    if (data.wrongSet) wrongSet = new Set(data.wrongSet);
  } catch(e) {}
};

// Init: check if user already logged in from session
document.addEventListener('DOMContentLoaded', function() {
  // Check if there's a saved current user
  const savedUser = sessionStorage.getItem('examCurrentUser');
  if (savedUser) {
    loginAs(savedUser);
  } else {
    showLoginModal();
  }
});

// Also save current user to session storage when login
const _origLoginAs = loginAs;
loginAs = function(name) {
  _origLoginAs(name);
  try { sessionStorage.setItem('examCurrentUser', name); } catch(e) {}
};

// And clear from session on logout
const _origLogout = logoutUser;
logoutUser = function() {
  _origLogout();
  try { sessionStorage.removeItem('examCurrentUser'); } catch(e) {}
};


// ==================== User Login System ====================
let currentUser = null;
const STORAGE_PREFIX = 'examState_';

function getStorageKey() { return STORAGE_PREFIX + currentUser; }

function getSavedUsers() {
  try { return JSON.parse(localStorage.getItem('examUsers') || '[]'); } catch(e) { return []; }
}
function saveUserList(users) {
  try { localStorage.setItem('examUsers', JSON.stringify(users)); } catch(e) {}
}

function showLoginModal() {
  document.getElementById('loginOverlay').style.display = 'flex';
  document.getElementById('loginInput').value = '';
  document.getElementById('loginInput').focus();
  const users = getSavedUsers();
  const list = document.getElementById('userList');
  if (users.length > 0) {
    let html = '<p>已有用户，点击切换：</p>';
    users.forEach(function(u) {
      html += '<button class="user-btn" data-username="' + u.replace(/'/g, '') + '">' + u + '</button>';
    });
    list.innerHTML = html;
    list.style.display = 'block';
  } else {
    list.style.display = 'none';
  }
}function hideLoginModal() {
  document.getElementById('loginOverlay').style.display = 'none';
}

function doLogin() {
  const name = document.getElementById('loginInput').value.trim();
  if (!name) { alert('请输入昵称'); return; }
  loginAs(name);
}

function loginAs(name) {
  currentUser = name;
  // Save to user list
  const users = getSavedUsers();
  if (!users.includes(name)) {
    users.push(name);
    saveUserList(users);
  }
  // Load user data
  loadState();
  hideLoginModal();
  document.getElementById('userNameDisplay').textContent = currentUser;
  render();
}

function logoutUser() {
  currentUser = null;
  document.getElementById('userDropdown').classList.remove('show');
  // Reset everything
  answeredState = {};
  wrongSet = new Set();
  currentIndex = 0;
  showLoginModal();
  render();
}

function toggleUserMenu() {
  const dd = document.getElementById('userDropdown');
  dd.classList.toggle('show');
}

// Close dropdown on click outside
document.addEventListener('click', function(e) {
  const badge = document.getElementById('userBadge');
  if (badge && !badge.contains(e.target)) {
    const dd = document.getElementById('userDropdown');
    if (dd) dd.classList.remove('show');
  }
});

// Override save/load to use user-specific keys
const _origSaveState = saveState;
const _origLoadState = loadState;

saveState = function() {
  if (!currentUser) return;
  const data = { answeredState, wrongSet: [...wrongSet] };
  try { localStorage.setItem(getStorageKey(), JSON.stringify(data)); } catch(e) {}
};

loadState = function() {
  answeredState = {};
  wrongSet = new Set();
  if (!currentUser) return;
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.answeredState) answeredState = data.answeredState;
    if (data.wrongSet) wrongSet = new Set(data.wrongSet);
  } catch(e) {}
};

// Init: check if user already logged in from session
document.addEventListener('DOMContentLoaded', function() {
  // Check if there's a saved current user
  const savedUser = sessionStorage.getItem('examCurrentUser');
  if (savedUser) {
    loginAs(savedUser);
  } else {
    showLoginModal();
  }
});

// Also save current user to session storage when login
const _origLoginAs = loginAs;
loginAs = function(name) {
  _origLoginAs(name);
  try { sessionStorage.setItem('examCurrentUser', name); } catch(e) {}
};

// And clear from session on logout
const _origLogout = logoutUser;
logoutUser = function() {
  _origLogout();
  try { sessionStorage.removeItem('examCurrentUser'); } catch(e) {}
};


document.getElementById('loginOverlay').addEventListener('click', function(e) {
  var btn = e.target.closest('.user-btn');
  if (btn && btn.dataset.username) {
    loginAs(btn.dataset.username);
  }
});

// ==================== Init ====================
loadState();
buildChapterButtons();
render();
