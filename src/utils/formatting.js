/**
 * src/utils/formatting.js
 * 金融數據格式化工具庫
 * 專注於可視性優化：統一全站數字、日期與金額的顯示邏輯
 */

/**
 * 格式化一般數值 (千分位)
 * @param {number|string} value - 數值
 * @param {number} decimals - 小數位數 (預設 2)
 * @returns {string} 格式化後的字串 (e.g., "1,234.56")
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === undefined || value === null || value === '' || isNaN(value)) {
    return '-';
  }
  const num = Number(value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/**
 * 格式化金額 (帶幣別處理)
 * @param {number|string} value - 金額
 * @param {string} currency - 幣別 ('TWD' | 'USD')
 * @returns {string} (e.g., "1,234", "12.34")
 */
export const formatCurrency = (value, currency = 'TWD') => {
  if (value === undefined || value === null || value === '' || isNaN(value)) {
    return '-';
  }
  
  const num = Number(value);
  
  // TWD 通常不顯示小數，USD 顯示 2 位
  const decimals = currency === 'TWD' ? 0 : 2;
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
};

/**
 * 格式化百分比 (自動乘 100 並加 %)
 * @param {number} value - 小數 (e.g., 0.15)
 * @param {number} decimals - 小數位數
 * @returns {string} (e.g., "15.00%")
 */
export const formatPercent = (value, decimals = 2) => {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.00%';
  }
  return `${(Number(value) * 100).toFixed(decimals)}%`;
};

/**
 * 格式化漲跌幅 (強制顯示正號)
 * @param {number} value - 數值
 * @param {string} suffix - 後綴 (e.g., "%", " USD")
 * @returns {string} (e.g., "+12.5%", "-5.2%")
 */
export const formatChange = (value, suffix = '') => {
  if (value === undefined || value === null || isNaN(value)) {
    return `-`;
  }
  const num = Number(value);
  const sign = num > 0 ? '+' : ''; // 0 不加號
  return `${sign}${formatNumber(num, 2)}${suffix}`;
};

/**
 * 縮寫大數值 (用於圖表或手機版)
 * @param {number} value 
 * @returns {string} (e.g., "1.2M", "350K")
 */
export const formatCompactNumber = (value) => {
  if (!value && value !== 0) return '-';
  const num = Number(value);
  
  return new Intl.NumberFormat('en-US', {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1
  }).format(num);
};

/**
 * 格式化日期
 * @param {string|Date} date - 日期物件或字串
 * @param {boolean} includeTime - 是否包含時間
 * @returns {string} (e.g., "2023/12/31", "2023/12/31 14:30")
 */
export const formatDate = (date, includeTime = false) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime && { hour: '2-digit', minute: '2-digit', hour12: false })
  };

  // 使用 zh-TW 格式 (YYYY/MM/DD)
  return d.toLocaleString('zh-TW', options);
};

/**
 * 相對時間 (用於最後更新時間)
 * @param {string|Date} date 
 * @returns {string} (e.g., "剛剛", "5分鐘前")
 */
export const timeAgo = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return '剛剛';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return formatDate(date);
};

/**
 * 取得趨勢顏色類別 (配合 CSS)
 * @param {number} value 
 * @param {boolean} isBg - 是否回傳背景色 class
 * @returns {string} class name ('text-green', 'text-red', 'bg-green'...)
 */
export const getTrendClass = (value, isBg = false) => {
  const num = Number(value) || 0;
  if (num > 0) return isBg ? 'bg-green' : 'text-green';
  if (num < 0) return isBg ? 'bg-red' : 'text-red';
  return isBg ? 'bg-gray' : 'text-sub'; // 0 或無變化
};
