import { CONFIG } from '../config';
import { useAuthStore } from '../stores/auth';

// 輔助函式：取得帶有 Auth Token 的 Headers
const getHeaders = () => {
    const authStore = useAuthStore();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
    };
};

// 通用 API 請求函式
const apiRequest = async (endpoint, options = {}) => {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const headers = getHeaders();
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...headers,
            ...options.headers
        }
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API Error: ${response.status}`);
    }

    // 如果回應是 204 No Content
    if (response.status === 204) return null;

    return await response.json();
};

// --- 交易記錄相關 API ---

export const getTransactions = async () => {
    // 假設後端提供 /api/records 來取得原始交易列表
    // 回傳格式預期為陣列: [{ id, Date, Symbol, Type, Qty, Price, ... }, ...]
    return await apiRequest('/api/records');
};

export const createTransaction = async (data) => {
    return await apiRequest('/api/records', {
        method: 'POST',
        body: JSON.stringify(data)
    });
};

export const updateTransaction = async (data) => {
    return await apiRequest('/api/records', {
        method: 'PUT',
        body: JSON.stringify(data)
    });
};

export const deleteTransaction = async (id) => {
    return await apiRequest('/api/records', {
        method: 'DELETE',
        body: JSON.stringify({ id })
    });
};

// --- 觸發後端計算 ---
export const triggerCalculation = async () => {
    // 呼叫 GitHub Actions 或後端觸發點
    return await apiRequest('/api/trigger-update', {
        method: 'POST'
    });
};
