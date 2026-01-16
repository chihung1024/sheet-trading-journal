// 在 computed processedRecords 中加入過濾：
const processedRecords = computed(() => {
    let result = store.records.filter(r => {
        // ... 原有的 Search/Type/Year 過濾 ...
        
        // ✅ 新增：Group 過濾
        let matchGroup = true;
        if (store.currentGroup !== 'all') {
            const tags = (r.tag || '').split(/[,;]/).map(t => t.trim());
            matchGroup = tags.includes(store.currentGroup);
        }
        
        return matchSearch && matchType && matchYear && matchGroup;
    });
    // ... 排序 ...
    return result;
});
