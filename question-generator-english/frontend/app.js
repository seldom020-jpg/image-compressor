// 等待 DOM 加载完成后再执行
document.addEventListener('DOMContentLoaded', function() {

// ========== DOM 元素获取 ==========
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const removeFile = document.getElementById('removeFile');
const generateBtn = document.getElementById('generateBtn');
const generateText = document.getElementById('generateText');
const generateLoading = document.getElementById('generateLoading');
const resultSection = document.getElementById('resultSection');
const questionsList = document.getElementById('questionsList');
const errorToast = document.getElementById('errorToast');
const totalCountSpan = document.getElementById('totalCount');
const fileRatioGroup = document.getElementById('fileRatioGroup');
const fileCountDisplay = document.getElementById('fileCountDisplay');
const fileRatioInputs = document.getElementById('fileRatioInputs');
const exportJsonBtn = document.getElementById('exportJson');
const exportTxtBtn = document.getElementById('exportTxt');
const exportXlsxBtn = document.getElementById('exportXlsx');
const toggleAnswersBtn = document.getElementById('toggleAnswers');
const printBtn = document.getElementById('printBtn');
const viewResultsBtn = document.getElementById('viewResultsBtn');

// ========== 状态 ==========
let selectedFiles = [];
let currentQuestions = null;
let answersVisible = false;

// 考试状态
let examMode = false;
let currentExamQuestion = 0;
let userAnswers = {};
let examQuestions = [];
let examUserInfo = {
  unit: '',
  name: ''
};
// 当前生成的考试ID（用于查看成绩）
let currentExamId = null;

// ========== 分享链接考试功能 ==========
// 使用后端短链接存储，URL 极短，微信可以转发，任何人都能访问

// 生成可分享的考试链接 - 调用后端 API 创建短链接
async function getShareableExamUrl() {
  if (!currentQuestions || currentQuestions.length === 0) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE}/api/create-shortlink`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ questions: currentQuestions })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Failed to create shortlink');
    }

    console.log('Created shortlink:', data.id);
    currentExamId = data.id;
    // Show view results button
    if (viewResultsBtn) {
      viewResultsBtn.style.display = 'inline-block';
    }
    return data.url || window.location.origin + window.location.pathname + '#exam/' + data.id;
  } catch (error) {
    console.error('Create shortlink failed:', error);
    showError('Failed to create shortlink: ' + error.message);
    return null;
  }
}

// Open result page for current exam - needs to be on window for onclick
window.openResultPage = function() {
  if (!currentExamId) {
    showError('Please click "Start Exam" to create exam link first');
    return;
  }
  const resultUrl = `${API_BASE}/results/${currentExamId}`;
  window.open(resultUrl, '_blank');
}

// 从 URL 加载考试 - 从后端 API 获取题目数据
async function loadExamFromUrl() {
  const hash = window.location.hash;
  if (!hash.startsWith('#exam/')) {
    return false;
  }

  const id = hash.replace('#exam/', '');
  if (!id || id.length !== 6) {
    console.error('Invalid exam id');
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/exam/${id}`);
    if (!response.ok) {
      throw new Error('Exam does not exist or has expired');
    }
    const data = await response.json();
    const questions = data.questions;

    if (Array.isArray(questions) && questions.length > 0) {
      currentQuestions = questions;
      // 直接进入全屏考试模式
      startExamFullscreen();
      return true;
    }
  } catch (e) {
    console.error('Failed to load exam from server:', e);
    showError(e.message);
  }
  return false;
}

// 全屏开始考试（从链接打开直接全屏）
function startExamFullscreen() {
  examMode = true;
  currentExamQuestion = 0;
  userAnswers = {};
  examQuestions = [...currentQuestions];
  // 隐藏原页面
  if (document.querySelector('main')) document.querySelector('main').style.display = 'none';
  if (document.querySelector('header')) document.querySelector('header').style.display = 'none';
  if (document.querySelector('footer')) document.querySelector('footer').style.display = 'none';
  document.getElementById('examMode').classList.add('show');
  // 先显示用户信息表单
  renderUserInfoForm();
}

// Render user info form (Company/Department, Name)
function renderUserInfoForm() {
  const container = document.getElementById('examContent');
  const html = `
    <div class="exam-user-info">
      <div class="exam-user-info-title">Please Enter Your Information</div>
      <div class="exam-user-form">
        <div class="form-group">
          <label>Company/Department:</label>
          <input type="text" id="examUnit" placeholder="Enter your company or department" value="${examUserInfo.unit || ''}">
        </div>
        <div class="form-group">
          <label>Name:</label>
          <input type="text" id="examName" placeholder="Enter your full name" value="${examUserInfo.name || ''}">
        </div>
        <div class="form-actions">
          <button class="exam-start-btn" onclick="startExamAfterInfo()">Start Exam</button>
        </div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// Start exam after info entered - needs to be on window for onclick
window.startExamAfterInfo = function() {
  const unitInput = document.getElementById('examUnit');
  const nameInput = document.getElementById('examName');
  const unit = unitInput.value.trim();
  const name = nameInput.value.trim();
  
  if (!unit) {
    alert('Please enter your company/department');
    return;
  }
  if (!name) {
    alert('Please enter your name');
    return;
  }
  
  examUserInfo.unit = unit;
  examUserInfo.name = name;
  currentExamQuestion = 0;
  renderExamQuestion();
}

// ========== API 基础 URL ==========
const API_BASE = window.location.origin;

// 更新总题数显示 - 只有勾选的才计入总数
function updateTotalCount() {
  let total = 0;
  ['single', 'multiple', 'judgment', 'essay'].forEach(type => {
    const checkbox = document.querySelector(`input[name="questionTypes"][value="${type}"]`);
    if (checkbox.checked) {
      const input = document.querySelector(`input[name="${type}Count"]`);
      let count = parseInt(input.value) || 0;
      if (count <= 0) {
        count = 1;
        input.value = 1;
      }
      total += count;
    }
  });
  totalCountSpan.textContent = total;
  return total;
}

// ========== 事件绑定 ==========

// 上传区域事件
dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files);
  handleFilesSelect(files);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) {
    handleFilesSelect(Array.from(e.target.files));
  }
});

removeFile.addEventListener('click', (e) => {
  e.stopPropagation();
  selectedFiles = [];
  fileInfo.style.display = 'none';
  dropZone.style.display = 'block';
  fileRatioGroup.style.display = 'none';
  generateBtn.disabled = true;
  generateText.textContent = 'Please upload a file first';
});

// 题型勾选和题量变化事件更新总数
document.querySelectorAll('.type-checkbox').forEach(el => {
  el.addEventListener('change', (e) => {
    updateTotalCount();
  });
});

document.querySelectorAll('.type-checkbox, .type-count-input').forEach(el => {
  el.addEventListener('change', updateTotalCount);
  el.addEventListener('input', updateTotalCount);
});

// 生成按钮事件
generateBtn.addEventListener('click', async () => {
  if (selectedFiles.length === 0) return;

  const config = getConfig();
  const questionTypes = Object.keys(config.questionTypeCounts);

  if (questionTypes.length === 0 || config.totalCount <= 0) {
    showError('Please select at least one question type with count > 0');
    return;
  }

  console.log('🚀 Sending request, questionTypeCounts =', config.questionTypeCounts);
  console.log('🚀 Sending request, totalCount =', config.totalCount);
  console.log('🚀 Sending request, fileRatios =', config.fileRatios);

  const formData = new FormData();
  selectedFiles.forEach((file, index) => {
    // 同时传递文件和正确编码的文件名
    formData.append('files', file);
    formData.append(`fileNames[${index}]`, file.name);
  });

  // 传递每个题型的自定义题量 - 每个单独 append，肯定能收到
  Object.entries(config.questionTypeCounts).forEach(([type, count]) => {
    formData.append(`questionCounts[${type}]`, count);
    console.log(`  ✓ Append questionCounts[${type}] = ${count}`);
  });

  // 传递文件比例（如果有设置）
  config.fileRatios.forEach((ratio, index) => {
    if (ratio !== null) {
      formData.append(`fileRatios[${index}]`, ratio);
      console.log(`  ✓ Append fileRatios[${index}] = ${ratio}`);
    }
  });

  formData.append('totalCount', config.totalCount);
  formData.append('difficulty', config.difficulty);

  // 显示加载状态
  generateBtn.disabled = true;
  generateText.style.display = 'none';
  generateLoading.style.display = 'inline';
  resultSection.style.display = 'none';

  try {
    const response = await fetch(`${API_BASE}/api/upload`, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Generation failed');
    }

    console.log('✓ Received response, questions count =', data.questions.length);
    currentQuestions = data.questions;
    renderQuestions(data.questions);
    afterRenderQuestions();
    resultSection.style.display = 'block';

    // Scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth' });

  } catch (error) {
    showError(error.message);
  } finally {
    // Restore button state
    generateBtn.disabled = false;
    generateText.style.display = 'inline';
    generateLoading.style.display = 'none';
  }
});

// 绑定开始考试按钮 -> 创建短链接，打开分享链接新窗口
const startExamBtn = document.getElementById('startExamBtn');
if (startExamBtn) {
  startExamBtn.addEventListener('click', async () => {
    if (!currentQuestions || currentQuestions.length === 0) {
      showError('No questions, cannot start exam');
      return;
    }
    // Show loading
    startExamBtn.disabled = true;
    startExamBtn.textContent = 'Creating link...';
    try {
      // Generate share link, open in new window
      const url = await getShareableExamUrl();
      if (url) {
        window.open(url, '_blank');
      }
    } finally {
      // Restore button
      startExamBtn.disabled = false;
      startExamBtn.textContent = 'Start Exam';
    }
  });
}

// 尝试从 URL 直接加载考试 - 异步加载
(async function tryLoadExam() {
  const loaded = await loadExamFromUrl();
  if (!loaded) {
    // 正常初始化
    updateTotalCount();
  }
})();

// ========== 功能函数 ==========

// 更新文件比例输入区域
function updateFileRatioInputs() {
  if (selectedFiles.length <= 1) {
    fileRatioGroup.style.display = 'none';
    return;
  }

  fileRatioGroup.style.display = 'block';
  fileCountDisplay.textContent = selectedFiles.length;

  // Clear and regenerate
  fileRatioInputs.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const div = document.createElement('div');
    div.className = 'file-ratio-item';
    div.innerHTML = `
      <label>File ${index + 1}: ${file.name}</label>
      <input type="number" name="fileRatio${index}" min="0" step="0.1" placeholder="Auto" class="file-ratio-input">
    `;
    fileRatioInputs.appendChild(div);
  });
}

// 获取选中的配置 - 只有勾选了 checkbox 才包含
function getConfig() {
  const questionTypeCounts = {};
  let targetCount = 0;

  ['single', 'multiple', 'judgment', 'essay'].forEach(type => {
    const input = document.querySelector(`input[name="${type}Count"]`);
    const checkbox = document.querySelector(`input[name="questionTypes"][value="${type}"]`);
    let count = parseInt(input.value) || 0;

    // 只有勾选了才会包含
    if (checkbox.checked) {
      // 如果勾选了但题量是 0，给默认 1
      if (count <= 0) {
        count = 1;
        input.value = 1;
      }
      questionTypeCounts[type] = count;
      targetCount += count;
    }
  });

  console.log('✅ Frontend getConfig: questionTypeCounts =', questionTypeCounts);
  console.log('✅ Frontend getConfig: targetCount =', targetCount);

  // 获取文件比例配置
  let fileRatios = [];
  if (selectedFiles.length > 1) {
    selectedFiles.forEach((file, index) => {
      const input = document.querySelector(`input[name="fileRatio${index}"]`);
      const ratio = parseFloat(input.value);
      fileRatios.push(!isNaN(ratio) && ratio > 0 ? ratio : null);
    });
  }

  const difficulty = document.querySelector('input[name="difficulty"]:checked').value;

  return {
    questionTypeCounts,
    totalCount: targetCount,
    fileRatios,
    difficulty
  };
}

// 处理多文件选择
function handleFilesSelect(files) {
  const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  let added = 0;

  files.forEach(file => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    if (!allowedExts.includes(ext)) {
      showError(`Unsupported file type: ${file.name}`);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError(`File too large: ${file.name} (max 10MB)`);
      return;
    }

    // 检查是否已经添加过同名文件
    const exists = selectedFiles.find(f => f.name === file.name);
    if (!exists) {
      selectedFiles.push(file);
      added++;
    }
  });

  if (selectedFiles.length > 0) {
    // Show selected files
    if (selectedFiles.length === 1) {
      fileName.textContent = selectedFiles[0].name;
    } else {
      fileName.textContent = `${selectedFiles.length} files selected`;
    }
    fileInfo.style.display = 'flex';
    dropZone.style.display = 'none';
    updateFileRatioInputs();
    generateBtn.disabled = false;
    generateText.textContent = 'Generate Questions';
  } else {
    selectedFiles = [];
    fileInfo.style.display = 'none';
    dropZone.style.display = 'block';
    fileRatioGroup.style.display = 'none';
    generateBtn.disabled = true;
    generateText.textContent = 'Please upload a file first';
  }

  updateTotalCount();
}

// 题型名称映射
const typeNameMap = {
  single: 'Single Choice',
  multiple: 'Multiple Choice',
  judgment: 'True/False',
  essay: 'Essay'
};

// 清洗选项：如果选项本身已经以 "A. " 开头，去除重复序号
// 反复清洗直到干净，处理 "A. A. xxx" -> "xxx"
function cleanOptionText(optText) {
  if (!optText || typeof optText !== 'string') return optText;
  
  let cleaned = optText.trim();
  
  const patterns = [
    /^[A-Za-z][\.\:\：]\s*/,         // A. / A: / A：
    /^[A-Za-z]\s+/,                  // A (空格分隔)
    /^\d[\.\:\：]\s*/,               // 1. / 1: / 1： (有些 AI 会用数字序号)
    /^①|^②|^③|^④|^⑤/,              // 带圈数字，也去掉
  ];
  
  let changed;
  do {
    changed = false;
    for (const pattern of patterns) {
      if (pattern.test(cleaned)) {
        cleaned = cleaned.replace(pattern, '').trim();
        changed = true;
        break;
      }
    }
  } while (changed);
  
  return cleaned.trim();
}

// 渲染题目
function renderQuestions(questions) {
  questionsList.innerHTML = '';

  questions.forEach((q, index) => {
    // 客观题末尾加括号供打印答题，简答题加 class 留空
    const answerParen = ['single', 'multiple', 'judgment'].includes(q.type) 
      ? `<span class="print-answer-paren">（&nbsp;&nbsp;&nbsp;&nbsp;）</span>` 
      : '';
    const isEssay = q.type === 'essay';
    const itemClass = `question-item ${isEssay ? 'essay-type' : ''}`;

    const item = document.createElement('div');
    item.className = itemClass;

    const typeName = typeNameMap[q.type] || '';
    const typeBadge = typeName ? `<span class="type-badge">${typeName}</span>` : '';

    let html = `
      <div class="question-header">
        <div class="question-number">${index + 1}</div>
        <div class="question-text">
          ${typeBadge}${escapeHtml(q.question)}${answerParen}
        </div>
      </div>
    `;

    // 选项（单选题、多选题）
    if (q.options && q.options.length > 0) {
      html += '<div class="options-list">';
      q.options.forEach((opt, optIndex) => {
        const isCorrect = Array.isArray(q.answer)
          ? q.answer.includes(String.fromCharCode(65 + optIndex)) || q.answer.includes(optIndex)
          : q.answer === String.fromCharCode(65 + optIndex) || q.answer === optIndex;

        const letter = String.fromCharCode(65 + optIndex);
        const cleanedOpt = cleanOptionText(opt);
        html += `<div class="option-item ${isCorrect ? 'correct' : ''}">${letter}. ${escapeHtml(cleanedOpt)}</div>`;
      });
      html += '</div>';
    }

    // Answer display (True/False, Essay)
    if (q.type === 'judgment') {
      html += `<div class="answer-display"><span class="answer-label">Answer:</span> ${q.answer ? 'True' : 'False'}</div>`;
    } else if (q.type === 'essay') {
      html += `<div class="answer-display"><span class="answer-label">Reference Answer:</span><br>${escapeHtml(q.answer)}</div>`;
    }

    // Explanation
    if (q.explanation) {
      html += `<div class="explanation"><span class="explanation-label">Explanation:</span> ${escapeHtml(q.explanation)}</div>`;
    }

    item.innerHTML = html;
    questionsList.appendChild(item);
  });
}

// HTML 转义防止 XSS
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 显示错误提示
function showError(message) {
  errorToast.textContent = message;
  errorToast.style.display = 'block';
  setTimeout(() => {
    errorToast.style.display = 'none';
  }, 4000);
}

// Export JSON button hidden
// exportJsonBtn.addEventListener('click', () => {
//   if (!currentQuestions) return;
//   downloadFile(JSON.stringify({ questions: currentQuestions }, null, 2), 'questions.json', 'application/json');
// });

// Export TXT
exportTxtBtn.addEventListener('click', () => {
  if (!currentQuestions) return;
  let text = '';
  currentQuestions.forEach((q, i) => {
    text += `${i + 1}. ${q.question}\n`;
    if (q.options) {
      q.options.forEach((opt, j) => {
        text += `   ${String.fromCharCode(65 + j)}. ${opt}\n`;
      });
    }
    let answerText = Array.isArray(q.answer) ? q.answer.join(', ') : q.answer;
    if (q.type === 'judgment') {
      answerText = q.answer ? '正确' : '错误';
    }
    text += `   答案：${answerText}\n`;
    if (q.explanation) {
      text += `   解析：${q.explanation}\n`;
    }
    text += '\n';
  });
  downloadFile(text, 'questions.txt', 'text/plain');
});

// 导出 Excel (xlsx) - 每题一行，题目/选项/答案/解析分四列
exportXlsxBtn.addEventListener('click', () => {
  if (!currentQuestions || !window.XLSX) {
    showError('Excel export library not loaded, please refresh and try again');
    return;
  }

  // Header
  const data = [
    ['#', 'Type', 'Question', 'Options', 'Answer', 'Explanation']
  ];

  // 每题一行
  currentQuestions.forEach((q, index) => {
    let optionsStr = '';
    if (q.options && q.options.length > 0) {
      optionsStr = q.options.map(opt => opt).join('；');
    }
    // 判断题固定选项
    if (q.type === 'judgment') {
      optionsStr = 'True;False';
    }

    let answerStr = '';
    if (Array.isArray(q.answer)) {
      // 多选题答案直接连写
      answerStr = q.answer.join('');
    } else {
      if (q.type === 'judgment') {
        // 判断题正确=A 错误=B
        answerStr = q.answer ? 'A' : 'B';
      } else {
        answerStr = String(q.answer);
      }
    }

    const explanation = q.explanation || '';

    data.push([
      index + 1,
      typeNameMap[q.type] || q.type,
      q.question,
      optionsStr,
      answerStr,
      explanation
    ]);
  });

  // Create workbook and download
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  XLSX.writeFile(wb, 'questions.xlsx');
});

// 下载文件
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Toggle show/hide answers
toggleAnswersBtn.addEventListener('click', () => {
  answersVisible = !answersVisible;
  if (answersVisible) {
    document.body.classList.add('show-answers');
    toggleAnswersBtn.textContent = 'Hide Answers';
    toggleAnswersBtn.classList.add('showing');
  } else {
    document.body.classList.remove('show-answers');
    toggleAnswersBtn.textContent = 'Show Answers';
    toggleAnswersBtn.classList.remove('showing');
  }
});

// 打印
printBtn.addEventListener('click', () => {
  window.print();
});

// Reset to hide answers after generating questions
function afterRenderQuestions() {
  answersVisible = false;
  document.body.classList.remove('show-answers');
  toggleAnswersBtn.textContent = 'Show Answers';
  toggleAnswersBtn.classList.remove('showing');
}

// ========== 考试核心功能 ==========

// 开始考试 - 已经在新窗口，直接进入
function startExam() {
  examMode = true;
  currentExamQuestion = 0;
  userAnswers = {};
  examQuestions = [...currentQuestions];
  document.getElementById('examMode').classList.add('show');
  renderExamQuestion();
}

// 关闭考试 - 需要挂载到 window 供 HTML onclick 调用
window.closeExam = function() {
  // 如果是新窗口打开（从生成页面打开，或者直接分享链接打开），尝试关闭窗口
  if (window.opener || window.history.length <= 1) {
    // 新窗口直接关闭
    window.close();
  } else {
    // 在原窗口打开，回到主页
    examMode = false;
    document.getElementById('examMode').classList.remove('show');
    // 显示原页面
    if (document.querySelector('main')) document.querySelector('main').style.display = 'block';
    if (document.querySelector('header')) document.querySelector('header').style.display = 'block';
    if (document.querySelector('footer')) document.querySelector('footer').style.display = 'block';
    // 清空 hash
    window.location.hash = '';
  }
}

// 渲染当前题目
function renderExamQuestion() {
  const container = document.getElementById('examContent');
  const question = examQuestions[currentExamQuestion];
  const questionNum = currentExamQuestion + 1;
  const total = examQuestions.length;

  let html = `
    <div class="exam-question">
      <div class="exam-question-number">Question ${questionNum} / ${total} total</div>
      <div class="exam-question-text">${escapeHtml(question.question)}</div>
  `;

  // Show options for objective questions
  if (['single', 'multiple', 'judgment'].includes(question.type)) {
    html += '<div class="exam-options">';
    if (question.type === 'judgment') {
      // True/False: True=A False=B
      html += `
        <div class="exam-option-item ${userAnswers[question.id] === 'A' ? 'selected' : ''}" data-answer="A" onclick="selectExamAnswer('${question.id}', 'A')">A. True</div>
        <div class="exam-option-item ${userAnswers[question.id] === 'B' ? 'selected' : ''}" data-answer="B" onclick="selectExamAnswer('${question.id}', 'B')">B. False</div>
      `;
    } else {
      // 单选/多选
      question.options.forEach((opt, i) => {
        const letter = String.fromCharCode(65 + i);
        const cleaned = cleanOptionText(opt);
        let selected = false;
        if (userAnswers[question.id]) {
          if (Array.isArray(userAnswers[question.id])) {
            selected = userAnswers[question.id].includes(letter);
          } else {
            selected = userAnswers[question.id] === letter;
          }
        }
        html += `
          <div class="exam-option-item ${selected ? 'selected' : ''}" data-answer="${letter}" onclick="selectExamAnswer('${question.id}', '${letter}')">${letter}. ${escapeHtml(cleaned)}</div>
        `;
      });
    }
    html += '</div>';
  }

  // Navigation buttons
  html += `
    <div class="exam-navigation">
      <button class="exam-nav-btn" id="prevQuestion" ${currentExamQuestion === 0 ? 'disabled' : ''} onclick="prevExamQuestion()">Previous</button>
      ${currentExamQuestion === total - 1 
        ? `<button class="exam-nav-btn exam-submit" id="submitExam" onclick="submitExam()">Submit Exam</button>` 
        : `<button class="exam-nav-btn" id="nextQuestion" onclick="nextExamQuestion()">Next</button>`
      }
    </div>
  `;

  html += '</div>';
  container.innerHTML = html;
}

// 选择答案 - 挂载到 window 供 onclick 调用
window.selectExamAnswer = function(questionId, answer) {
  const question = examQuestions.find(q => q.id === parseInt(questionId));
  if (question.type === 'multiple') {
    // 多选题支持多选，点击选中/取消选中
    if (!userAnswers[questionId]) {
      userAnswers[questionId] = [];
    }
    const index = userAnswers[questionId] ? userAnswers[questionId].indexOf(answer) : -1;
    if (index > -1) {
      // 已经选中，取消选中
      userAnswers[questionId].splice(index, 1);
    } else {
      // 添加选中
      userAnswers[questionId].push(answer);
    }
  } else {
    // 单选/判断直接替换
    userAnswers[questionId] = answer;
  }
  // 重新渲染更新选中状态
  renderExamQuestion();
};

// 上一题 - 需要挂载到 window 供 HTML onclick 调用
window.prevExamQuestion = function() {
  if (currentExamQuestion > 0) {
    currentExamQuestion--;
    renderExamQuestion();
  }
};

// 下一题 - 需要挂载到 window 供 HTML onclick 调用
window.nextExamQuestion = function() {
  if (currentExamQuestion < examQuestions.length - 1) {
    currentExamQuestion++;
    renderExamQuestion();
  }
};

// Submit exam for grading - needs to be on window for onclick
window.submitExam = function() {
  // Check for unanswered questions
  const unanswered = examQuestions.filter(q => 
    ['single', 'multiple', 'judgment'].includes(q.type) && userAnswers[q.id] === undefined
  );

  if (unanswered.length > 0) {
    const confirmed = window.confirm(`${unanswered.length} questions are unanswered, are you sure you want to submit?`);
    if (!confirmed) return;
  }

  // 判分
  let score = 0;
  let total = 0;
  const resultDetail = [];

  examQuestions.forEach(q => {
    const userAnswer = userAnswers[q.id];
    let correct = false;
    let correctAnswer = q.answer;

    // 转换正确答案格式
    if (q.type === 'judgment') {
      // 判断正确答案 true=A false=B
      correctAnswer = correctAnswer ? 'A' : 'B';
    } else if (!Array.isArray(correctAnswer)) {
      correctAnswer = String(correctAnswer);
    }

    // 一题一分
    if (['single', 'judgment'].includes(q.type)) {
      total++;
      if (userAnswer === correctAnswer) {
        score++;
        correct = true;
      } else {
        correct = false;
      }
    } else if (q.type === 'multiple') {
      total++;
      // 多选题必须完全一致才得分
      const userSorted = (userAnswer || []).sort().join(',');
      const correctSorted = (correctAnswer || []).sort().join(',');
      if (userSorted === correctSorted) {
        score++;
        correct = true;
      } else {
        correct = false;
      }
    } else if (q.type === 'essay') {
      // 简答题自行批改
      total++;
      correct = null;
    }

    resultDetail.push({
      question: q,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      correct: correct,
      isEssay: q.type === 'essay'
    });
  });

  // 显示结果
  showExamResult(score, total, resultDetail);
}

// 显示考试结果，并提交成绩到服务器
async function showExamResult(score, total, detail) {
  const container = document.getElementById('examContent');
  
  // Show loading first
  container.innerHTML = `
    <div class="exam-result">
      <div class="exam-result-title">Exam completed, submitting result...</div>
    </div>
  `;
  
  // Prepare submit data
  const submitData = {
    examId: window.location.hash ? window.location.hash.replace('#exam/', '') : '',
    unit: examUserInfo.unit,
    name: examUserInfo.name,
    score: score,
    total: total,
    submittedAt: new Date().toISOString(),
    details: detail.map(d => ({
      questionId: d.question.id,
      userAnswer: d.userAnswer,
      correctAnswer: d.correctAnswer,
      correct: d.correct,
      isEssay: d.isEssay
    }))
  };
  
  // Submit result to server
  let submitSuccess = false;
  let submitError = null;
  try {
    const response = await fetch(`${API_BASE}/api/submit-result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        submitSuccess = true;
        console.log('Result submitted successfully:', result);
      } else {
        submitError = result.error || 'Server returned error';
      }
    } else {
      submitError = `Server error: ${response.status}`;
    }
  } catch (e) {
    console.error('Failed to submit result:', e);
    submitError = e.message || 'Network error';
  }
  
  // Render result page
  let html = `
    <div class="exam-result">
      <div class="exam-result-title">Exam Completed</div>
      ${submitSuccess ? 
        `<div class="submit-success-message">✅ Result submitted successfully</div>` :
        `<div class="submit-error-message">⚠️ Failed to submit result: ${submitError || 'Unknown error'}</div>`
      }
      <div class="exam-result-score">${score} / ${total}</div>
      <div class="exam-result-info">
        <p><strong>Company:</strong>${escapeHtml(examUserInfo.unit)}</p>
        <p><strong>Name:</strong>${escapeHtml(examUserInfo.name)}</p>
      </div>
      <div class="exam-result-detail">
  `;

  detail.forEach((item, index) => {
    const statusClass = item.correct === true ? 'correct' : item.correct === false ? 'wrong' : '';
    const statusText = item.correct === true 
      ? '✓ Correct' 
      : item.correct === false 
        ? '✗ Incorrect' 
        : '📝 Essay - self grading';
    let userAnswerText = item.userAnswer;
    if (Array.isArray(item.userAnswer)) {
      userAnswerText = item.userAnswer.join(', ');
    }

    // Show correct answer only if wrong
    let correctAnswerText = '';
    if (item.correct === false) {
      if (Array.isArray(item.correctAnswer)) {
        correctAnswerText = item.correctAnswer.join(', ');
      } else {
        correctAnswerText = item.correctAnswer;
      }
    }

    html += `
      <div class="exam-result-item ${statusClass}">
        <div class="exam-result-question">${index + 1}. ${escapeHtml(item.question.question)}</div>
          <div class="exam-result-answer">Your answer: ${userAnswerText || 'Not answered'} ${statusText}</div>
          ${item.correct === false ? `<div class="exam-result-answer">Correct answer: ${correctAnswerText}</div>` : ''}
      </div>
    `;
  });

  html += `
      </div>
      <div class="exam-navigation">
        <button class="exam-nav-btn" onclick="closeExam()">Close</button>
        <button class="exam-nav-btn exam-screenshot" onclick="captureScoreToClipboard()">Screenshot to Clipboard</button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// 截图分数页面到剪贴板 - 需要挂载到 window 供 onclick 调用
window.captureScoreToClipboard = async function() {
  try {
    const container = document.querySelector('.exam-result').parentNode;
    const canvas = await html2canvas(container);
    canvas.toBlob(async (blob) => {
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        alert('Screenshot saved to clipboard, you can paste it directly!');
      } catch (err) {
        console.error('Failed to save to clipboard:', err);
        // Fallback: open image for user to right-click save
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exam-score-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('Cannot auto-save to clipboard, please save the image manually');
      }
    }, 'image/png');
  } catch (error) {
    console.error('Screenshot failed:', error);
    alert('Screenshot failed: ' + error.message);
  }
};

}); // 结束 DOMContentLoaded
