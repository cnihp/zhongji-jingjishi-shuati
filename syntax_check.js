// ================ 状?================
let allQuestions = [...questionBank];
let currentFilter = 'all';
let currentTab = 'practice';
let currentChapter = 'all';
let currentSection = 'all';
let currentIndex = 0;
let answeredState = {};  // { id: { selected: [...], submitted: bool, isCorrect: bool } }
let wrongSet = new Set(); // 错题id集合

// ================ 工具 ================
const letters = ['A', 'B', 'C', 'D', 'E'];

function getFilteredQuestions() {
  let qs = [...allQuestions];
  if (currentTab === 'wrong') {
    qs = qs.filter(q => wrongSet.has(q.id));
    if (qs.length === 0) return [];
  }
  if (currentTab === 'chapter' && currentChapter !== 'all') {
    qs = qs.filter(q => q.chapter === currentChapter);
  }
  if (currentTab === 'chapter' && currentSection !== 'all') {
    qs = qs.filter(q => q.section === currentSection);
  }
  if (currentFilter === 'single') qs = qs.filter(q => q.type === 'single');
  else if (currentFilter === 'multi') qs = qs.filter(q => q.type === 'multi' || q.type === 'case');
  return qs;
}

function getTypeLabel(q) {
  if (q.type === 'single') return '单选题';
  if (q.type === 'multi') return '多选题';
  return '案例分析题';
}

function saveState() {
  localStorage.setItem('jjjs_answered', JSON.stringify(answeredState));
  localStorage.setItem('jjjs_wrong', JSON.stringify([...wrongSet]));
}

function loadState() {
  try {
    const a = localStorage.getItem('jjjs_answered');
    if (a) answeredState = JSON.parse(a);
    const w = localStorage.getItem('jjjs_wrong');
    if (w) wrongSet = new Set(JSON.parse(w));
  } catch(e) {}
}

// ================ 渲染 ================
function render() {
  const qs = getFilteredQuestions();
  if (qs.length === 0) {
    if (currentTab === 'wrong') {
      document.getElementById('qContent').innerHTML = '<div class="result-box"><div style="font-size:40px;margin-bottom:12px;">&#x2705;</div><div style="font-size:18px;font-weight:600;color:#666;">错题集已清空，继续保持！</div></div>';
    } else {
      document.getElementById('qContent').innerHTML = '<div class="result-box"><div style="font-size:18px;color:#888;">当前筛选条件下没有题目</div></div>';
    }
    updateStats();
    updateProgress();
    return;
  }
  if (currentIndex >= qs.length) currentIndex = qs.length - 1;
  if (currentIndex < 0) currentIndex = 0;
  const q = qs[currentIndex];
  const state = answeredState[q.id] || { selected: [], submitted: false, isCorrect: false };
  const isMulti = (q.type === 'multi' || q.type === 'case');
  const submitted = state.submitted;

  let html = '<div class="q-header">';
  html += `<span class="q-number">#${currentIndex+1}/${qs.length}</span>`;
  html += `<span class="q-type ${isMulti ? 'multi' : ''} ${q.type === 'case' ? 'case' : ''}">${getTypeLabel(q)} · ${q.category}</span>`;
  if (q.chapter) html += `<span class="chapter-tag">${q.chapter}</span>`;
  html += '</div>';
  html += `<div class="q-text">${q.text}</div>`;
  if (q.type === 'case') {
    html += `<div style="font-size:13px;color:#1e40af;background:#dbeafe;padding:8px 12px;border-radius:8px;margin-bottom:12px;">&#x2139;&#xFE0F; 案例分析题为不定项选择题，错选不得分，少选每个正确选项得0.5分
</div>`;
  } else if (q.type === 'multi') {
    html += `<div style="font-size:13px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:8px;margin-bottom:12px;">&#x2139;&#xFE0F; 多选题须选出两个及以上正确选项，错选不得分，少选每个正确选项得0.5分
</div>`;
  }

  html += '<div class="options">';
  const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
  q.options.forEach((opt, idx) => {
    let cls = 'option';
    if (submitted) {
      cls += ' disabled';
      if (correctAnswer.includes(idx)) cls += ' correct';
      else if (state.selected.includes(idx)) cls += ' wrong';
    } else {
      if (state.selected.includes(idx)) cls += ' selected';
    }
    html += `<div class="${cls}" data-idx="${idx}" onclick="selectOption(this, ${q.id}, ${isMulti})">`;
    html += `<span class="letter">${letters[idx]}</span>`;
    html += `<span>${opt}</span>`;
    html += '</div>';
  });
  html += '</div>';

  // 解析
  if (submitted) {
    const correctStr = correctAnswer.map(i => letters[i]).join(', ');
    const isCorrect = state.isCorrect;
    html += `<div class="explanation show">`;
    html += `<div class="label">${isCorrect ? '&#x2705; 回答正确' : '&#x274C; 回答错误'} · 正确答案?{correctStr}</div>`;
    html += `<div>${q.explanation}</div>`;
    html += '</div>';
  } else {
    html += '<div class="explanation" id="explBox"></div>';
  }

  document.getElementById('qContent').innerHTML = html;

  // 按钮状?  document.getElementById('prevBtn').disabled = (currentIndex === 0);
  document.getElementById('nextBtn').disabled = (currentIndex >= qs.length - 1);
  const subBtn = document.getElementById('submitBtn');
  const showBtn = document.getElementById('showAnsBtn');
  subBtn.disabled = submitted;
  if (submitted) {
    subBtn.textContent = '已提交';
  } else {
    subBtn.textContent = isMulti ? '提交答案' : '提交答案';
  }

  updateStats();
  updateProgress();
}

function selectOption(el, qid, isMulti) {
  const state = answeredState[qid] || { selected: [], submitted: false, isCorrect: false };
  if (state.submitted) return;
  const idx = parseInt(el.dataset.idx);
  if (isMulti) {
    const pos = state.selected.indexOf(idx);
    if (pos > -1) state.selected.splice(pos, 1);
    else state.selected.push(idx);
  } else {
    state.selected = [idx];
  }
  answeredState[qid] = state;
  saveState();
  render();
}

// 提交答案
document.getElementById('submitBtn').addEventListener('click', function() {
  const qs = getFilteredQuestions();
  if (qs.length === 0) return;
  const q = qs[currentIndex];
  const state = answeredState[q.id] || { selected: [], submitted: false, isCorrect: false };
  if (state.submitted) return;
  if (state.selected.length === 0) { alert('请先选择一个选项'); return; }

  const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
  const sortedSelected = [...state.selected].sort();
  const sortedCorrect = [...correctAnswer].sort();
  let isCorrect = false;
  if (q.type === 'single') {
    isCorrect = sortedSelected.length === 1 && sortedCorrect.length === 1 && sortedSelected[0] === sortedCorrect[0];
  } else {
    // 多?案例：完全正确才算正确（模拟考试严格模式?    isCorrect = sortedSelected.length === sortedCorrect.length && sortedSelected.every((v,i) => v === sortedCorrect[i]);
  }
  state.submitted = true;
  state.isCorrect = isCorrect;
  answeredState[q.id] = state;

  if (!isCorrect) {
    wrongSet.add(q.id);
  } else {
    wrongSet.delete(q.id);
  }
  saveState();
  render();
});

// 看答案
document.getElementById('showAnsBtn').addEventListener('click', function() {
  const qs = getFilteredQuestions();
  if (qs.length === 0) return;
  const q = qs[currentIndex];
  const correctAnswer = Array.isArray(q.answer) ? q.answer : [q.answer];
  const correctStr = correctAnswer.map(i => letters[i]).join(', ');
  const explBox = document.querySelector('.explanation');
  if (explBox) {
    explBox.classList.add('show');
    explBox.innerHTML = `<div class="label">&#x1F4DD; 参考答案：${correctStr}</div><div>${q.explanation}</div>`;
  }
});

// 导航
document.getElementById('prevBtn').addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; render(); } });
document.getElementById('nextBtn').addEventListener('click', () => {
  const qs = getFilteredQuestions();
  if (currentIndex < qs.length - 1) { currentIndex++; render(); }
});

// 重置
document.getElementById('resetBtn').addEventListener('click', function() {
  if (!confirm('确定要重新开始吗？所有答题记录将被清除')) return;
  answeredState = {};
  wrongSet = new Set();
  currentIndex = 0;
  saveState();
  render();
});

// 统计
function updateStats() {
  const total = allQuestions.length;
  let done = 0, correct = 0;
  Object.values(answeredState).forEach(s => {
    if (s.submitted) {
      done++;
      if (s.isCorrect) correct++;
    }
  });
  document.getElementById('totalQ').textContent = total;
  document.getElementById('doneQ').textContent = done;
  document.getElementById('correctQ').textContent = correct;
  document.getElementById('rateQ').textContent = done ? Math.round(correct/done*100) + '%' : '0%';
  document.getElementById('wrongBadge').textContent = wrongSet.size;
}

function updateProgress() {
  const qs = getFilteredQuestions();
  const done = qs.filter(q => {
    const s = answeredState[q.id];
    return s && s.submitted;
  }).length;
  const pct = qs.length ? Math.round(done/qs.length*100) : 0;
  document.getElementById('progressFill').style.width = pct + '%';
}

// 生成章节按钮
function buildChapterButtons() {
  const chSet = new Set();
  allQuestions.forEach(q => {
    if (q.chapter) chSet.add(q.chapter);
  });
  const container = document.getElementById('chapterBtns');
  if (!container) return;
  
  // Group by major part
  const parts = [
    { name: '第一部分 经济学基础', regex: /^(第一|第二|第三|第四|第五|第六|第七|第八|第九|第十)章/ },
    { name: '第二部分 财政', regex: /^(第十一|第十二|第十三|第十四|第十五|第十六)章/ },
    { name: '第三部分 货币与金融', regex: /^(第十七|第十八|第十九|第二十|第二十一)章/ },
    { name: '第四部分 统计', regex: /^(第二十二|第二十三|第二十四|第二十五)章/ },
    { name: '第五部分 会计', regex: /^(第二十六|第二十七|第二十八|第二十九)章/ },
    { name: '第六部分 法律', regex: /^(第三十|第三十一|第三十二|第三十三)章/ },
    { name: '农业经济', regex: /^第.*章.*农业|^农业/ },
  ];
  
  let html = '<button class="chapter-btn active" data-chapter="all">全部章节</button>';
  
  const sortedChs = Array.from(chSet).sort();
  let currentPart = '';
  
  sortedChs.forEach(ch => {
    // Find which part this chapter belongs to
    let partName = '';
    if (ch.includes('农业')) {
      partName = '农业经济';
    } else {
      for (const p of parts) {
        if (p.regex.test(ch)) {
          partName = p.name;
          break;
        }
      }
    }
    
    if (partName && partName !== currentPart) {
      currentPart = partName;
      html += `<div style="width:100%;font-size:12px;color:#888;margin:6px 0 2px 4px;font-weight:600;">${partName}</div>`;
    }
    
    html += `<button class="chapter-btn" data-chapter="${ch.replace(/'/g, "\'")}">${ch}</button>`;
  });
  
  container.innerHTML = html;
  
  // Add click handlers
  
function buildSectionButtons(chapterName) {
  var secSet = new Set();
  allQuestions.forEach(function(q) {
    if (q.chapter === chapterName && q.section) secSet.add(q.section);
  });
  var container = document.getElementById('sectionBtns');
  if (!container) return;
  var bar = document.getElementById('sectionBar');
  if (secSet.size === 0) { bar.style.display = 'none'; return; }
  var html = '<button class="section-btn active" data-section="all">全部?/button>';
  Array.from(secSet).sort().forEach(function(sec) {
    html += '<button class="section-btn" data-section="' + sec.replace(/'/g, "\\'") + '">' + sec + '</button>';
  });
  container.innerHTML = html;
  bar.style.display = 'block';
  container.querySelectorAll('.section-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.section-btn').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      currentSection = this.dataset.section;
      currentIndex = 0;
      render();
    });
  });
}

  container.querySelectorAll('.chapter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      container.querySelectorAll('.chapter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentChapter = this.dataset.chapter;
      currentSection = 'all';
      currentIndex = 0;
      buildSectionButtons(currentChapter);
      render();
    });
  });
}

// 标签切换
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentTab = this.dataset.tab;
    currentIndex = 0;
    // Show/hide chapter bar
    const chapterBar = document.getElementById('chapterBar');
    if (chapterBar) {
      chapterBar.style.display = (currentTab === 'chapter') ? 'block' : 'none';
      var secBar = document.getElementById('sectionBar');
      if (secBar) secBar.style.display = 'none';
      currentSection = 'all';
      if (currentTab === 'chapter') buildChapterButtons();
    }
    render();
  });
});

// 模式切换
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    if (currentTab === 'wrong') return;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    currentFilter = this.dataset.mode;
    currentIndex = 0;
    render();
  });
});

// ================ 启动 ================
loadState();
buildChapterButtons();
render();
