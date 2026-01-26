/**
 * 金融數據格式化工具集
 * 用於統一全站的數字顯示、貨幣格式與顏色邏輯
 */

// 貨幣格式化 (預設 USD)
export const formatCurrency = (value, currency = 'USD', decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// 百分比格式化
export const formatPercent = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0.00%';
  return `${(value * 100).toFixed(decimals)}%`;
};

// 數字格式化 (不帶貨幣符號，帶千分位)
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// 獲利/虧損顏色 Class 判斷
// 國際慣例：綠色盈利 (Profit)，紅色虧損 (Loss)
// 可依據需求調整為台股模式 (紅漲綠跌)
export const getPnLColor = (value) => {
  if (!value || value === 0) return 'text-gray-500 dark:text-gray-400';
  return value > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
};

// 獲利/虧損背景色 Class (用於標籤或卡片背景)
export const getPnLBgColor = (value) => {
  if (!value || value === 0) return 'bg-gray-100 dark:bg-gray-800';
  return value > 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20';
};

// 日期格式化
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};
