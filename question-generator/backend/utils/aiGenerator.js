const axios = require('axios');

// 配置AI模型 - 从环境变量读取，每次调用获取最新
function getConfig() {
  return {
    AI_PROVIDER: process.env.AI_PROVIDER || 'openai',
    API_KEY: process.env.AI_API_KEY || '',
    API_URL: process.env.AI_API_URL || '',
    MODEL: process.env.AI_MODEL || 'gpt-3.5-turbo'
  };
}

// 构造消息内容，支持文本和图片混合
function buildMessages(fileContents, questionTypes, count, difficulty) {
  const typeMap = {
    single: '单选题',
    multiple: '多选题',
    judgment: '判断题',
    essay: '简答题'
  };

  const difficultyText = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难';
  const typeNames = questionTypes.map(t => typeMap[t]).join('、');

  let systemPrompt = `你是一个专业的考试命题专家。请根据用户提供的文档内容（包含文本和图片），生成总共${count}道${typeNames}。难度为${difficultyText}。

要求：
1. 题目必须基于给定的文档/图片内容，不能出材料以外的知识
2. 选项要具有迷惑性，正确答案唯一（多选题所有正确选项都要列出）
3. **严禁出重复的题目**，所有题目内容不能重复，考点不能重复，要覆盖不同位置的内容
4. 尽可能从文档不同段落/图片不同区域选取知识点出题，保持题目多样性
5. 如果图片中有表格、图表，请识别表格内容并基于内容出题
6. 输出必须是严格JSON格式，不要有其他说明文字

格式说明：

对于单选题：
{
  "id": 1,
  "type": "single",
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "A",
  "explanation": "答案解释（可选，基于文档内容说明）"
}

对于多选题：
{
  "id": 1,
  "type": "multiple",
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": ["A", "C"],
  "explanation": "答案解释（可选，基于文档内容说明）"
}

对于判断题：
{
  "id": 1,
  "type": "judgment",
  "question": "题目内容",
  "answer": true/false,
  "explanation": "解释"
}

对于简答题：
{
  "id": 1,
  "type": "essay",
  "question": "题目内容",
  "answer": "参考答案要点",
  "explanation": "评分要点说明"
}

最终输出包裹在 questions 数组中：
{
  "questions": [
    ...所有题目按上述格式...
  ]
}
`;

  // 构建多模态消息
  const contentParts = [];
  
  // 先放系统提示词作为用户消息的一部分
  contentParts.push({
    type: 'text',
    text: systemPrompt + '\n\n以下是文档内容：\n\n'
  });

  // 添加所有文件内容，文本就是文字，图片就是base64
  fileContents.forEach(file => {
    if (file.type === 'text') {
      contentParts.push({
        type: 'text',
        text: `--- 文件：${file.name} ---\n${file.text}\n\n`
      });
    } else if (file.type === 'image') {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${file.mimeType};base64,${file.base64}`
        }
      });
    }
  });

  return contentParts;
}

// 调用AI生成题目，支持文本+图片混合
async function generateQuestions(fileContents, options) {
  const { questionTypes = ['single'], count = 10, difficulty = 'medium' } = options;
  const { AI_PROVIDER } = getConfig();

  const hasImages = fileContents.some(f => f.type === 'image');
  const messages = buildMessages(fileContents, questionTypes, count, difficulty);

  if (AI_PROVIDER === 'openai' || (AI_PROVIDER === 'tongyi' && hasImages)) {
    return await callOpenAIMultimodal(messages);
  } else if (AI_PROVIDER === 'tongyi') {
    // 纯文本还是用原来的方式
    const textOnlyContent = fileContents.filter(f => f.type === 'text').map(f => f.text).join('\n\n');
    const prompt = buildPrompt(textOnlyContent, questionTypes, count, difficulty);
    return await callTongyi(prompt);
  } else if (AI_PROVIDER === 'custom') {
    const textOnlyContent = fileContents.filter(f => f.type === 'text').map(f => f.text).join('\n\n');
    const prompt = buildPrompt(textOnlyContent, questionTypes, count, difficulty);
    return await callCustom(prompt);
  } else {
    throw new Error(`不支持的AI提供商: ${AI_PROVIDER}`);
  }
}

// 保持兼容旧接口
function buildPrompt(content, questionTypes, count, difficulty) {
  const typeMap = {
    single: '单选题',
    multiple: '多选题',
    judgment: '判断题',
    essay: '简答题'
  };

  const difficultyText = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '中等' : '困难';
  const typeNames = questionTypes.map(t => typeMap[t]).join('、');

  return `你是一个专业的考试命题专家。请根据以下提供的文档内容，生成总共${count}道${typeNames}。难度为${difficultyText}。

要求：
1. 题目必须基于给定的文档内容，不能出文档以外的知识
2. 选项要具有迷惑性，正确答案唯一（多选题所有正确选项都要列出）
3. **严禁出重复的题目**，所有题目内容不能重复，考点不能重复，要覆盖文档不同位置的内容
4. 尽可能从文档不同段落选取知识点出题，保持题目多样性
5. 输出必须是严格JSON格式，不要有其他说明文字
格式说明：

对于单选题：
{
  "id": 1,
  "type": "single",
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "A",
  "explanation": "答案解释（可选，基于文档内容说明）"
}

对于多选题：
{
  "id": 1,
  "type": "multiple",
  "question": "题目内容",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": ["A", "C"],
  "explanation": "答案解释（可选，基于文档内容说明）"
}

对于判断题：
{
  "id": 1,
  "type": "judgment",
  "question": "题目内容",
  "answer": true/false,
  "explanation": "解释"
}

对于简答题：
{
  "id": 1,
  "type": "essay",
  "question": "题目内容",
  "answer": "参考答案要点",
  "explanation": "评分要点说明"
}

最终输出包裹在 questions 数组中：
{
  "questions": [
    ...所有题目按上述格式...
  ]
}

文档内容如下：

${content}
`;
}

// 调用OpenAI兼容接口（纯文本）
async function callOpenAI(prompt) {
  const { API_KEY, API_URL, MODEL } = getConfig();
  try {
    const url = API_URL || 'https://api.openai.com/v1/chat/completions';
    const response = await axios.post(url, {
      model: MODEL,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data.choices[0].message.content;
    return parseAIResponse(text);
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`AI调用失败: ${errorMsg}`);
  }
}

// 调用OpenAI兼容接口（多模态，支持图片）
async function callOpenAIMultimodal(contentParts) {
  const { API_KEY, API_URL, MODEL } = getConfig();
  try {
    let url = API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    // 如果API_URL结尾没有chat/completions，自动加上
    // 兼容用户配置成 https://dashscope.aliyuncs.com/compatible-mode/v1 的情况
    if (!url.endsWith('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }
    
    // 多模态必须使用VL模型，如果用户配置的不是VL模型，默认加上-vl-plus
    let useModel = MODEL;
    if (!useModel || !useModel.includes('vl')) {
      useModel = 'qwen-vl-plus';
      console.log(`⚠️  当前模型 ${MODEL} 不是多模态模型，自动切换到 ${useModel}`);
    }
    
    // 通义千问多模态兼容OpenAI格式，直接调用
    const response = await axios.post(url, {
      model: useModel,
      messages: [
        { role: 'user', content: contentParts }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✓ 多模态API响应成功');
    const text = response.data.choices[0].message.content;
    console.log('✓ AI返回长度:', text.length);
    
    // 如果返回HTML，说明API出错了返回了错误页面，记录下来
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error('✗ AI返回了HTML而不是JSON，响应内容:', text.slice(0, 500));
      throw new Error('API返回了错误HTML页面，请检查API地址和密钥配置');
    }
    
    return parseAIResponse(text);
  } catch (error) {
    console.error('OpenAI Multimodal API error:', error.response?.data || error.message);
    // 如果axios返回HTML错误页面，捕获它
    if (error.response && typeof error.response.data === 'string' && 
        (error.response.data.startsWith('<!DOCTYPE') || error.response.data.startsWith('<html'))) {
      console.error('✗ API返回HTML错误页面，检查API_URL配置是否正确');
      throw new Error('API返回了错误HTML页面，请检查：\n1. API_URL是否正确（通义千问兼容模式应为 https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions）\n2. API_KEY是否正确\n3. 是否开通了千问VL模型权限');
    }
    const errorMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`AI调用失败: ${errorMsg}`);
  }
}

// 调用通义千问（阿里云百炼）
async function callTongyi(prompt) {
  const { API_KEY, API_URL, MODEL } = getConfig();
  try {
    // 使用OpenAI兼容接口，更稳定
    let url = API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
    // 如果API_URL结尾没有chat/completions，自动加上
    // 兼容用户配置成 https://dashscope.aliyuncs.com/compatible-mode/v1 的情况
    if (!url.endsWith('/chat/completions')) {
      url = url.replace(/\/$/, '') + '/chat/completions';
    }
    const response = await axios.post(url, {
      model: MODEL || 'qwen-plus',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = response.data.choices[0].message.content;
    return parseAIResponse(text);
  } catch (error) {
    console.error('Tongyi API error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`AI调用失败: ${errorMsg}`);
  }
}

// 调用自定义API
async function callCustom(prompt) {
  const { API_KEY, API_URL, MODEL } = getConfig();
  try {
    const response = await axios.post(API_URL, {
      prompt: prompt
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // 假设返回格式和OpenAI兼容
    const text = response.data.choices[0].message.content;
    return parseAIResponse(text);
  } catch (error) {
    console.error('Custom API error:', error.response?.data || error.message);
    const errorMsg = error.response?.data?.error?.message || error.message;
    throw new Error(`AI调用失败: ${errorMsg}`);
  }
}

// 解析AI响应，提取JSON
function parseAIResponse(text) {
  try {
    // 尝试直接解析
    return JSON.parse(text);
  } catch (e) {
    // 如果失败，尝试提取代码块中的JSON
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) ||
                      text.match(/```\n([\s\S]*?)\n```/) ||
                      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e2) {
        console.error('JSON parse error after extraction:', e2);
        throw new Error('无法解析AI返回的JSON格式，请重试');
      }
    }
    throw new Error('无法提取题目JSON，请重试');
  }
}

module.exports = { generateQuestions };
