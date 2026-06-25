// =====================================================

// 設定

// =====================================================

 

/** @type {string} OpenRouter APIキー（sk-or-...） */

const OPENROUTER_API_KEY = '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';

 

/** @type {string} 使用AIモデル */

const AI_MODEL = 'poolside/laguna-m.1:free';

 

/** @type {number} 画像アップロード上限（バイト） */

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

 

// =====================================================

// 初期化

// =====================================================

 

let originalBtnText = '';

 

window.addEventListener('DOMContentLoaded', function () {

  const generateBtn = document.getElementById('generateBtn');

  const copyBtn = document.getElementById('copyBtn');

 

  if (generateBtn) {

    originalBtnText = generateBtn.textContent;

    generateBtn.addEventListener('click', startAiPlanner);

  }

 

  if (copyBtn) {

    copyBtn.addEventListener('click', copyResult);

  }

 

  restoreFormValues();

  restoreLastResult();

});

 

/** localStorageからフォームの入力値を復元する */

function restoreFormValues() {

  const map = {

    stock_ing: 'stockIngredients',

    prior_ing: 'priorityIngredients',

    always_ing: 'alwaysIngredients',

    budget_lim: 'budgetLimit',

    adult_count: 'adultCount',

    child_count: 'childCount',

    day_count: 'dayCount',

  };

 

  for (const [key, id] of Object.entries(map)) {

    const el = document.getElementById(id);

    if (!el) continue;

 

    const saved = localStorage.getItem(key);

    if (saved !== null) {

      el.value = saved;

    }

  }

}

 

/** localStorageから前回の生成結果を復元する */

function restoreLastResult() {

  const savedHtml = localStorage.getItem('last_result_html');

  if (!savedHtml) return;

 

  showResult(savedHtml, false);

}

 
// =====================================================
// UI操作ヘルパー
// =====================================================

/**
 * ローディング状態を切り替える
 * @param {boolean} isLoading
 */
function setLoading(isLoading) {
  const loadingText = document.getElementById('loadingText');
  const generateBtn = document.getElementById('generateBtn');

  if (loadingText) {
    loadingText.style.display = isLoading ? 'block' : 'none';
  }

  if (generateBtn) {
    generateBtn.disabled = isLoading;
    generateBtn.textContent = isLoading ? '作成中...' : originalBtnText;
  }
}

/**
 * エラーメッセージをインライン表示する
 * @param {string} message
 */
function showError(message) {
  const errorArea = document.getElementById('errorArea');

  if (!errorArea) {
    console.error('[showError] errorAreaが見つかりません:', message);
    return;
  }

  errorArea.textContent = message;
  errorArea.style.display = 'block';
  errorArea.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

/**
 * エラー表示をクリアする
 */
function clearError() {
  const errorArea = document.getElementById('errorArea');

  if (!errorArea) {
    return;
  }

  errorArea.textContent = '';
  errorArea.style.display = 'none';
}

// =====================================================

// メインフロー

// =====================================================

 

/** 献立生成のエントリーポイント */

async function startAiPlanner() {

  clearError();

 

  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === 'YOUR_OPENROUTER_API_KEY_HERE') {

    showError('OpenRouter APIキーが設定されていません。app.js 内の OPENROUTER_API_KEY を設定してください。');

    return;

  }

 

  const fileInput = document.getElementById('screenshotInput');

 

  if (!fileInput) {

    showError('画像入力欄が見つかりません。HTMLの id="screenshotInput" を確認してください。');

    return;

  }

 

  if (fileInput.files.length > 0 && fileInput.files[0].size > MAX_FILE_SIZE) {

    const sizeMB = (fileInput.files[0].size / 1024 / 1024).toFixed(1);

    showError(`画像ファイルが大きすぎます（${sizeMB}MB）。5MB以下の画像を選択してください。`);

    return;

  }

 

  saveFormValues();

  setLoading(true);

 

  const resultArea = document.getElementById('resultArea');

  const resultActions = document.getElementById('resultActions');

 

  if (resultArea) resultArea.style.display = 'none';

  if (resultActions) resultActions.style.display = 'none';

 

  try {

    let screenshotText = 'なし';

 

    if (fileInput.files.length > 0) {

      screenshotText = await analyzeScreenshot(fileInput.files[0]);

    }

 

    await generateMenuPlan(screenshotText);

  } catch (error) {

    console.error('[startAiPlanner]', error);

    showError(error.message || 'エラーが発生しました。しばらく待ってから再試行してください。');

  } finally {

    setLoading(false);

  }

}

 

/** フォームの入力値をlocalStorageに保存する */

function saveFormValues() {

  const fields = [

    ['stock_ing', 'stockIngredients'],

    ['prior_ing', 'priorityIngredients'],

    ['always_ing', 'alwaysIngredients'],

    ['budget_lim', 'budgetLimit'],

    ['adult_count', 'adultCount'],

    ['child_count', 'childCount'],

    ['day_count', 'dayCount'],

  ];

 

  for (const [key, id] of fields) {

    const el = document.getElementById(id);

    if (el) {

      localStorage.setItem(key, el.value);

    }

  }

}

 // =====================================================

// スクショ解析

// =====================================================

 

/**

* 画像をBase64に変換してAPIに送り、料理名・食材を受け取る

* @param {File} file

* @returns {Promise<string>}

*/

async function analyzeScreenshot(file) {

  const base64Data = await fileToBase64(file);

 

  const prompt = `画像から、料理名と必要な具体的な食材（肉や野菜などのメイン固形物のみ）を抜き出し、以下のJSON形式でのみ返してください。

{"name": "料理名", "ingredients": ["食材1", "食材2"]}`;

 

  const responseJson = await callOpenRouter([

    {

      role: 'user',

      content: [

        { type: 'text', text: prompt },

        {

          type: 'image_url',

          image_url: { url: `data:${file.type};base64,${base64Data}` },

        },

      ],

    },

  ]);

 

  const text = responseJson.choices?.[0]?.message?.content?.trim() ?? '';

  const match = text.match(/\{[\s\S]*\}/);

 

  if (!match) {

    console.warn('スクショ解析: 有効なJSONが返されませんでした。フォールバックします。');

    return '（画像の読み込みに一部失敗したため、定番のアイデアから補正してください）';

  }

 

  try {

    const parsed = JSON.parse(match[0]);

    const name = parsed.name || '料理名不明';

    const ingredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];

 

    return `料理名: ${name}, 必要な食材: ${ingredients.join(', ')}`;

  } catch (e) {

    console.warn('スクショ解析: JSON解析に失敗しました。フォールバックします。', e);

    return '（画像の解析に一部失敗したため、定番のアイデアから補正してください）';

  }

}

 

/**

* FileをBase64文字列に変換する

* @param {File} file

* @returns {Promise<string>}

*/

function fileToBase64(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

 

    reader.onloadend = () => {

      const result = reader.result;

 

      if (typeof result !== 'string') {

        reject(new Error('Base64変換に失敗しました。'));

        return;

      }

 

      const base64 = result.split(',')[1];

      base64 ? resolve(base64) : reject(new Error('Base64変換に失敗しました。'));

    };

 

    reader.onerror = () => reject(new Error('画像ファイルの読み込みに失敗しました。'));

    reader.readAsDataURL(file);

  });

}

 // =====================================================

// 献立生成

// =====================================================

 

/**

* 献立生成プロンプトを組み立ててAPIを呼び出し、結果を表示する

* @param {string} screenshotInfo

*/

async function generateMenuPlan(screenshotInfo) {

  const stock = document.getElementById('stockIngredients')?.value || '特になし';

  const priority = document.getElementById('priorityIngredients')?.value || '特になし';

  const always = document.getElementById('alwaysIngredients')?.value || '特になし';

  const budget = document.getElementById('budgetLimit')?.value || '指定なし';

  const adultCount = document.getElementById('adultCount')?.value || '2';

  const childCount = document.getElementById('childCount')?.value || '0';

  const dayCount = document.getElementById('dayCount')?.value || '5';

 

  const mainPrompt = buildMenuPrompt({

    stock,

    priority,

    always,

    budget,

    adultCount,

    childCount,

    dayCount,

    screenshotInfo,

  });

 

  const responseJson = await callOpenRouter([

    { role: 'user', content: mainPrompt },

  ]);

 

  if (!responseJson.choices?.length) {

    throw new Error('じぇみちゃんからの応答がありませんでした。APIキーやモデル名を確認してください。');

  }

 

  const rawText = responseJson.choices[0].message?.content ?? '';

  const html = convertMarkdownToHtml(rawText);

 

  showResult(html);

}

 

/**

* 献立生成プロンプトを組み立てる

* @param {{

*  stock: string,

*  priority: string,

*  always: string,

*  budget: string,

*  adultCount: string,

*  childCount: string,

*  dayCount: string,

*  screenshotInfo: string

* }} params

* @returns {string}

*/

function buildMenuPrompt({

  stock,

  priority,

  always,

  budget,

  adultCount,

  childCount,

  dayCount,

  screenshotInfo,

}) {

  return `あなたは優秀な献立プランナー「じぇみちゃん」です。

以下の条件をもとに、**大人${adultCount}人・子ども${childCount}人・${dayCount}日分の夕食献立**を作成してください。

 

## 基本条件

【作成日数】${dayCount}日分

【対象曜日】指定なし。${dayCount}日分として自然な順番で作成

【必要な食事】夕食のみ

【1食あたりの品数】主菜1品、副菜1品、サラダ1品、汁物1品

【家族構成】大人${adultCount}人、子ども${childCount}人

 

## 重視ポイント

- 作り置きを活用する

- お弁当に使い回せるおかずを含める

- 平日は30分以内で作れる献立を優先する

- 洗い物が多すぎないようにする

- 栄養バランスを考慮する

 

## 調理傾向

- 揚げ物は少なめ

- 炒め物に偏らない

- 煮る・焼く・蒸す・レンジ調理をバランスよく使う

- 和食・洋食・中華を${dayCount}日間でバランスよく組み合わせる

- 作り置き考慮

- 使い切りを目標に

- STAN自動調理鍋有り。煮物系はこちらを使用可能

- 山本ゆり、長谷川あかりのレシピが好み

 

## 子ども向け調整

- 子どもがいる場合は、辛すぎる味付けやクセの強い食材を避ける

- 子どもでも食べやすい味付けにする

- 大人向けに辛味や薬味を足せる場合は「大人は後足し」として提案する

- 子どもが0人の場合は、この条件は考慮しなくてよい

 

## 手持ち食材

【冷蔵庫・冷凍庫・食品庫にある食材】

${stock}

 

【優先的に消費したい食材】

${priority}

※傷みやすいため、できるだけ早い日程で使用すること。

 

【常備食材】

${always}

※常備食材は買い足し不要として扱うこと。

 

【★追加の限定バズレシピ条件】

ユーザーが作りたいと思っているインスタのスクショレシピ情報： ${screenshotInfo}

※もし「なし」以外であれば、このレシピを${dayCount}日間のどこか1日の主菜または副菜に必ず組み込み、必要な食材も買い足し計算に含めてください。

 

## 買い足し条件

【買い足し予算】 ${budget} を意識すること。

【買い足し方針】

- 魚を献立に取り入れること

- 豚こま主菜に偏らないこと

- 買い足しは必要最低限にすること

- 高価な食材や特殊な調味料は避けること

- 魚は鮭、白身魚、さば缶など、安価で扱いやすいものを優先すること

 

## 献立作成ルール

1. 同じ主菜を繰り返さない

2. 主菜が豚こまばかりにならないようにする

3. 同じ調理法が連続しすぎないようにする

4. 炒め物が多くなりすぎないようにする

5. 食材をできるだけ使い切る

6. 優先食材は早い日程で使用する

7. 作り置きや汁物の使い回しを提案する

8. お弁当に転用しやすいおかずを含める

9. 栄養バランスを考慮する

10. 現実的に家庭で作れる献立にする

11. 特殊な調味料や高価な食材は極力避ける

12. 毎日揚げ物にしない

13. 洗い物が多すぎる献立は避ける

 

## 出力形式

必ず以下の形式を守り、${dayCount}日分出力してください。

曜日は「1日目（月）」「2日目（火）」のように、必要日数分だけ自然に割り当ててください。

 

■1日目（月）ジャンル：和食／洋食／中華など

主菜：

副菜：

サラダ：

汁物：

使用食材：

追加購入食材：

調理のポイント：

お弁当への使い回し：

 

以降、同じ形式で${dayCount}日分続けてください。

 

## 最後に必ず出力する内容

1. 期間全体で使用する食材一覧

2. 買い足しが必要な食材一覧（チェックボックス形式「- [ ] 食材名」で出力してください）

3. 概算予算

4. 食材の使い切り状況

5. 作り置き・使い回しポイント

6. ${dayCount}日間のジャンルバランス

7. 調理法のバランス

 

## 注意点

- 買い足し予算内を意識してください。

- ただし、味噌・醤油・砂糖・塩・こしょう・油などの基本調味料が常備に含まれていない場合は、必要に応じて「家にあれば買い足し不要」と補足してください。

- 魚を増やす場合でも、予算超えやすい場合は「さば缶」「特売の鮭」「冷凍白身魚」など節約案を提示してください。

- 主菜が豚こまに偏らないようにしてください。

- 炒め物が多くなりすぎないようにしてください。`;

}

// =====================================================

// テキスト変換

// =====================================================

 

/**

* HTML特殊文字をエスケープする

* @param {string} text

* @returns {string}

*/

function escapeHtml(text) {

  return String(text)

    .replace(/&/g, '&amp;')

    .replace(/</g, '&lt;')

    .replace(/>/g, '&gt;')

    .replace(/"/g, '&quot;')

    .replace(/'/g, '&#039;');

}

 

/**

* AIが返すMarkdown混じりテキストを安全にHTMLへ変換する

* @param {string} text

* @returns {string}

*/

function convertMarkdownToHtml(text) {

  const escaped = escapeHtml(text);

 

  return escaped

    .replace(/- \[ \] /g, '▢ ')

    .replace(/^(■.+)$/gm, '<h2>$1</h2>')

    .replace(/^## (.+)$/gm, '<h3>$1</h3>')

    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    .replace(/\n/g, '<br>');

}

 

// =====================================================

// OpenRouter API 呼び出し

// =====================================================

 

/**

* OpenRouter API を呼び出す共通関数

* @param {Array<{role: string, content: any}>} messages

* @returns {Promise<object>}

*/

async function callOpenRouter(messages) {

  const url = 'https://openrouter.ai/api/v1/chat/completions';

 

  const controller = new AbortController();

   const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒でタイムアウト

 

  try {

    const response = await fetch(url, {

      method: 'POST',

      signal: controller.signal,

      headers: {

        'Content-Type': 'application/json',

        Authorization: `Bearer ${OPENROUTER_API_KEY}`,

        'HTTP-Referer': window.location.href,

        'X-Title': '5days menu',

      },

      body: JSON.stringify({

        model: AI_MODEL,

        messages,

      }),

    });

 

    const responseText = await response.text();

 

    let json;

    try {

      json = JSON.parse(responseText);

    } catch (e) {

      throw new Error(`APIレスポンスの解析に失敗しました: ${responseText.slice(0, 200)}`);

    }

 

    if (!response.ok) {

      const msg = json.error?.message ?? JSON.stringify(json);

      throw new Error(`API エラー (${response.status}): ${msg}`);

    }

 

    return json;

  } catch (e) {

    if (e.name === 'AbortError') {

      throw new Error('リクエストがタイムアウトしました（12秒）。時間をおいて再試行してください。');

    }

    throw e;

  } finally {

    clearTimeout(timeoutId);

  }

}

 

// =====================================================

// 結果操作

// =====================================================

 

/**

* 結果テキストをクリップボードにコピーする

*/

function copyResult() {

  clearError();

 

  const resultArea = document.getElementById('resultArea');

  const text = resultArea?.innerText ?? '';

 

  if (!text.trim()) {

    showError('コピーする献立がありません。');

    return;

  }

 

  navigator.clipboard.writeText(text)

    .then(() => {

      const btn = document.getElementById('copyBtn');

      if (btn) {

        const original = btn.textContent;

        btn.textContent = 'コピーしました！';

        setTimeout(() => {

          btn.textContent = original;

        }, 2000);

      }

    })

    .catch(() => {

      showError('コピーに失敗しました。ブラウザの権限設定を確認してください。');

    });

}

 

/** 保存済み献立を削除して結果エリアをリセットする */

function clearSavedResult() {

  if (!confirm('保存済みの献立を削除しますか？')) return;

 

  localStorage.removeItem('last_result_html');

 

  const resultArea = document.getElementById('resultArea');

  const resultActions = document.getElementById('resultActions');

 

  if (resultArea) {

    resultArea.innerHTML = '';

    resultArea.style.display = 'none';

  }

 

  if (resultActions) {

    resultActions.style.display = 'none';

  }

}
