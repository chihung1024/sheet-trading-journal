import { ref, onMounted, onUnmounted, watch } from 'vue';
import { usePortfolioStore } from '../stores/portfolio';
import { useAuthStore } from '../stores/auth';
import { useToast } from './useToast';
import {
    shouldScheduleMarketRefresh,
    shouldTriggerMarketRefresh
} from '../services/refreshPolicy';

/**
 * ç›¤ä¸­è‡ªå‹•åˆ·æ–° Composable
 * åŠŸèƒ½ èªªæ˜Ž:
 * 1. å°è‚¡ç›¤ä¸­ï¼ˆ09:00-13:30ï¼‰å’Œç¾Žè‚¡ç›˜ã€¨è‡ªå‹•è§¼ç™¼ triggerUpdate
 * 2. æ¯3 åˆ†é’ŸåŸ·è¡Œä¸€æ¬¡ï¼Œ60 ç§’é€¾æ™‚
 * 3. æ›¨åœæˆ–ä¸¥é¢#èŠæ™‚åœæ­¢è‡ªå‹•è§¼ç™¼
 * 4. è‡ªå‹•åˆ¤æ–­æ˜Ÿä»¦æ—¥å¯é–“ æ™‚é–“
 */
export function useMarketHoursRefresh() {
    const isEnabled = ref(true);
    const isRunning = ref(false);
    const isPaused = ref(false);
    const lastTriggerTime = ref(null);
    const nextTriggerTime = ref(null);
    const currentMarket = ref(null); // 'TW', 'US', or null
    const timeRemaining = ref(0); // å€’æ•¸ç§’æ•¸

    let refreshTimer = null;
    let checkTimer = null;
    let countdownTimer = null; // UI å€’æ•¸å€‹æ™‚å™¨

    const INTERVAL_MS = 3 * 60 * 1000; // 3 åˆ†éš¨
    const INTERVAL_SECONDS = 3 * 60; // 180 ç§’
    const TIMEOUT_MS = 60 * 1000; // 60 ç§’é€‚æ™‚

    const authStore = useAuthStore();

    const isPageVisible = () => {
        if (typeof document === 'undefined') return true;
        return document.visibilityState !== 'hidden';
    };

    /**
     * åˆ¤æ–‡æ˜¯å¦ç‚ºç¾Žåœ‹åŒå‹•æ™²é–“
     * å¤å‹•æ•‚é–“ï¼š7æœˆç¬¬äºŒå€‹é€±æ—¥ 02:00 ~ 13æœˆç¬¬ä¸€å€‹é€±æ—¥ 02:00
     */
    const isDaylightSavingTime = () => {
        const now = new Date();
        const year = now.getFullYear();

        // 3æœˆç¬¬äºŒå€‹é€±æ—¥
        const march = new Date(year, 2, 1);
        const marchSecondSunday = new Date(year, 2, 8 + (7 - march.getDay()) % 7);

        // 13æœˆç¬¬ä¸€ä€Ÿå‘¨æ—¥
        const november = new Date(year, 10, 1);
        const novemberFirstSunday = new Date(year, 10, 1 + (7 - november.getDay()) % 7);

        return now >= marchSecondSunday && now < novemberFirstSunday;
    };

    /**
     * åˆ¤æ–­å°è‚£æ˜¯å¦é–‹ç›¤
     * é€±ä¸€è‡²é€±äº• 09:00-13:300ï¼ˆå°åŒ—æ™‚é–“ï¼‰
     */
    const isTWMarketOpen = () => {
        const now = new Date();
        const day = now.getDay();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const timeInMinutes = hours * 60 + minutes;

        // é€±ä¸€åˆ²Ç¦Ç’êT€ Ä´Ô¤4(€€€€€€€¥˜€¡‘…ä€ð€Äñð‘…ä€ø€Ô¤É•ÑÕÉ¸™…±Í”ì4(4(€€€€€€€€¼¼€ÀäèÀÀ€ ÔÐÃ–"¦Bà¤ƒ–"À€ÄÌèÌÀ€ àÄÃ–"¦J¾ò$4(€€€€€€€É•ÑÕÉ¸Ñ¥µ•%¹5¥¹ÕÑ•Ì€øô€ÔÐÀ€˜˜Ñ¥µ•%¹5¥¹ÕÑ•Ì€ðô€àÄÀì4(€€€ôì4(4(€€€€¼¨¨4(€€€€€¨ƒ–"“šZžÖg¢
‡šb¿–B›¦Z/žn`4(€€€€€¨ƒ–’?–.Wšf¦ZO¾ò#S¾ò'¾òk–>Ã–2_šf¦ZL€ÈÄèÌÀ´ÀÐèÀÀ4(€€€€€¨ƒ–³’î“šf¦ZO¾ò#MS¾ò'¾òk–>Ã–2_šf¦ZL€ÈÈèÌÀ´ÀÔèÀÀ4(€€€€€¨¼4(€€€½¹ÍÐ¥ÍUM5…É­•Ñ=Á•¸€ô€ ¤€ôøì4(€€€€€€€½¹ÍÐ¹½Ü€ô¹•Ü…Ñ” ¤ì4(€€€€€€€½¹ÍÐ‘…ä€ô¹½Ü¹•Ñ…ä ¤ì4(€€€€€€€½¹ÍÐ¡½ÕÉÌ€ô¹½Ü¹•Ñ!½ÕÉÌ ¤ì4(€€€€€€€½¹ÍÐµ¥¹ÕÑ•Ì€ô¹½Ü¹•Ñ5¥¹ÕÑ•Ì ¤ì4(€€€€€€€½¹ÍÐÑ¥µ•%¹5¥¹ÕÑ•Ì€ô¡½ÕÉÌ€¨€ØÀ€¬µ¥¹ÕÑ•Ìì4(4(€€€€€€€½¹ÍÐ¥ÍMP€ô¥Í…å±¥¡ÑM…Ù¥¹Q¥µ” ¤ì4(4(€€€€€€€€¼¼ƒ–’?–.'¾òhÈÄèÌÀ´ÀÐèÀÃ¾ò3–Ï’î”èÐÈèÌÀ´ÀÔèÀÀ4(€€€€€€€½¹ÍÐ½Á•¹Q¥µ”€ô¥ÍMP€ü€ÈÄ€¨€ØÀ€¬€ÌÀ€è€ÈÈ€¨€ØÀ€¬€ÌÀì4(€€€€€€€½¹ÍÐ±½Í•Q¥µ”€ô¥ÍMP€ü€Ð€¨€ØÀ€è€Ô€¨€ØÀì4(4(€€€€€€€€¼¼ƒšfk’â+šfšºÔ€ ÈÄèÌÀ¼ÈÈèÌÀ€´€ÈÌèÔä§¾òk¦Ç’â–"Ã¦Ç’êP4(€€€€€€€¥˜€¡Ñ¥µ•%¹5¥¹ÕÑ•Ì€øô½Á•¹Q¥µ”€˜˜‘…ä€øô€Ä€˜˜‘…ä€ðô€Ô¤ì4(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì4(€€€€€€€ô4(4(€€€€€€€€¼¼ƒ–3šf§šf¦®à€ ÀÀèÀÀ€´€ÀÐèÀÀ¼ÀÔèÀÀ§¾òk¦Ç’ê3–"Ã¦Ç–´4(€€€€€€€¥˜€¡Ñ¥µ•%¹5¥¹ÕÑ•Ì€ðô±½Í•Q¥µ”€˜˜‘…ä€øô€È€˜˜‘…ä€ðô€Ø¤ì4(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì4(€€€€€€€ô4(4(€€€€€€€É•ÑÕÉ¸™…±Í”ì4(€€€ôì4(4(€€€€¼¨¨4(€€€€€¨ƒ–"“šZ·šb¿–B›ž
ë’úo’â·šf¦ZL4(€€€€€¨¼4(€€€½¹ÍÐ¥Í5…É­•Ñ!½ÕÉÌ€ô€ ¤€ôøì4(€€€€€€€¥˜€¡¥ÍQ]5…É­•Ñ=Á•¸ ¤¤ì4(€€€€€€€€€€€ÕÉÉ•¹Ñ5…É­•Ð¹Ù…±Õ”€ô€Q\œì4(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì4(€€€€€€€ô4(€€€€€€€¥˜€¡¥ÍUM5…É­•Ñ=Á•¸ ¤¤ì4(€€€€€€€€€€€ÕÉÉ•¹Ñ5…É­•Ð¹Ù…±Õ”€ô€ULœì4(€€€€€€€€€€€É•ÑÕÉ¸ÑÉÕ”ì4(€€€€€€€ô4(€€€€€€€ÕÉÉ•¹Ñ5…É­•Ð¹Ù…±Õ”€ô¹Õ±°ì4(€€€€€€€É•ÑÕÉ¸™…±Í”ì4(€€€ôì4(4(€€€½¹ÍÐ•ÑI•™É•Í¡½¹Ñ•áÐ€ô€ ¤€ôøì4(€€€€€€€½¹ÍÐ¡…ÍQ½­•¸€ô	½½±•…¸¡…ÕÑ¡MÑ½É”¹Ñ½­•¸¤ì4(€€€€€€€É•ÑÕÉ¸ì4(€€€€€€€€€€€•¹…‰±•è¥Í¹…‰±•¹Ù…±Õ”°4(€€€€€€€€€€€Á…ÕÍ•è¥ÍA…ÕÍ•¹Ù…±Õ”°4(€€€€€€€€€€€Ù¥Í¥‰±”è¥ÍA…•Y¥Í¥‰±” ¤°4(€€€€€€€€€€€µ…É­•Ñ!½ÕÉÌè¥Í5…É­•Ñ!½ÕÉÌ ¤°4(€€€€€€€€€€€¡…ÍQ½­•¸°4(€€€€€€€€€€€Ñ½­•¹áÁ¥É•è€…¡…ÍQ½­•¸ñð…ÕÑ¡MÑ½É”¹¥ÍQ½­•¹áÁ¥É• ¤4(€€€€€€€ôì4(€€€ôì4(4(€€€½¹ÍÐÕÁ‘…Ñ•9•áÑQÉ¥•ÉQ¥µ”€ô€ ¤€ôøì4(€€€€€€€¹•áÑQÉ¥•ÉQ¥µ”¹Ù…±Õ”€ô¹•Ü…Ñ”¡…Ñ”¹¹½Ü ¤€¬%9QIY1}5L¤ì4(€€€€€€€Ñ¥µ•I•µ…¥¹¥¹œ¹Ù…±Õ”€ô%9QIY1}M=9Lì4(€€€ôì4(4(€€€½¹ÍÐÍÑ…ÉÑ½Õ¹Ñ‘½Ý¸€ô€ ¤€ôøì4(€€€€€€€¥˜€¡½Õ¹Ñ‘½Ý¹Q¥µ•È¤É•ÑÕÉ¸ì4(€€€€€€€½Õ¹Ñ‘½Ý¹Q¥µ•È€ôÍ•Ñ%¹Ñ•ÉÙ…°  ¤€ôøì4(€€€€€€€€€€€¥˜€¡Ñ¥µ•I•µ…¥¹¥¹œ¹Ù…±Õ”€ø€À¤ì4(€€€€€€€€€€€€€€€Ñ¥µ•I•µ…¥¹¥¹œ¹Ù…±Õ”´´ì4(€€€€€€€€€€€ô4(€€€€€€€ô°€ÄÀÀÀ¤ì4(€€€ôì4(4(€€€½¹ÍÐÍÑ½Á½Õ¹Ñ‘½Ý¸€ô€ ¤€ôøì4(€€€€€€€¥˜€¡½Õ¹Ñ‘½Ý¹Q¥µ•È¤ì4(€€€€€€€€€€€±•…É%¹Ñ•ÉÙ…°¡½Õ¹Ñ‘½Ý¹Q¥µ•È¤ì4(€€€€€€€€€€€½Õ¹Ñ‘½Ý¹Q¥µ•È€ô¹Õ±°ì4(€€€€€€€ô4(€€€ôì4(4(€€€½¹ÍÐÍÑ½ÁI•™É•Í¡Q¥µ•È€ô€ ¤€ôøì4(€€€€€€€¥˜€¡É•™É•Í¡Q¥µ•È¤ì4(€€€€€€€€€€€±•…É%¹Ñ•ÉÙ…°¡É•™É•Í¡Q¥µ•È¤ì4(€€€€€€€€€€€É•™É•Í¡Q¥µ•È€ô¹Õ±°ì4(€€€€€€€ô4(€€€€€€€¹•áÑQÉ¥•ÉQ¥µ”¹Ù…±Õ”€ô¹Õ±°ì4(€€€ôì4(4(€€€½¹ÍÐÍÑ½ÁÑ¥Ù•M¡•‘Õ±”€ô€ ¤€ôøì4(€€€€€€€ÍÑ½ÁI•™É•Í¡Q¥µ•È ¤ì4(€€€€€€€ÍÑ½Á½Õ¹Ñ‘½Ý¸ ¤ì4(€€€€€€€Ñ¥µ•I•µ…¥¹¥¹œ¹Ù…±Õ”€ô€Àì4(€€€ôì4(4(€€€€¼¨¨4(€€€€€¨ƒ¢žžfÿšZÃ¾ò#–âÛ–þ¯šfš:Ÿ–"ß¾ò$4(€€€€€¨¼4(€€€½¹ÍÐÑÉ¥•ÉI•™É•Í €ô…Íå¹Œ€ ¤€ôøì4(€€€€€€€½¹ÍÐÁ½ÉÑ™½±¥½MÑ½É”€ôÕÍ•A½ÉÑ™½±¥½MÑ½É” ¤ì4(€€€€€€€½¹ÍÐì…‘‘Q½…ÍÐô€ôÕÍ•Q½…ÍÐ ¤ì4(€€€€€€€½¹ÍÐ½¹Ñ•áÐ€ô•ÑI•™É•Í¡½¹Ñ•áÐ ¤ì4(4(€€€€€€€¥˜€ …Í¡½Õ±‘QÉ¥•É5…É­•ÑI•™É•Í ¡ì4(€€€€€€€€€€€€¸¸¹½¹Ñ•áÐ°4(€€€€€€€€€€€‰ÕÍäèÁ½ÉÑ™½±¥½MÑ½É”¹¥ÍA½±±¥¹œñðÁ½ÉÑ™½±¥½MÑ½É”¹±½…‘¥¹œ°4(€€€€€€€€€€€ÉÕ¹¹¥¹œè¥ÍIÕ¹¹¥¹œ¹Ù…±Õ”4(€€€€€€€ô¤¤ì4(€€€€€€€€€€€½¹Í½±”¹±½œ ŸŠj?¾â<ožnc’â·–"ßšZÁtƒžn»–&7šä»¶ä¸å…è¨±è‡ªå‹•è§£ç™¿ï¼Œè·³éŽæ­¤æ¬¡åˆ·æ–°');
            return false;
        }

        isRunning.value = true;
        lastTriggerTime.value = new Date();

        const market = currentMarket.value === 'TW' ? 'å°è‚¡å“· :  ' : 'ç¾Žè‚¡å“· ';
        console.log(`ðŸš€ [ç›¤ä¸­åˆ·æ–°] ${market}ç›˜ä¸­ï¼Œè§¼ç™¼ triggerUpdate...`);

        try {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS);
            });
            const updatePromise = portfolioStore.triggerUpdate();

            await Promise.race([updatePromise, timeoutPromise]);
            console.log('âœ… [ç›˜ä¸­åˆ·æ–°] triggerUpdate å®Œæˆ');
            return true;
        } catch (error) {
            if (error.message === 'TIMEOUT') {
                console.warn('âš ï¸ [ç›¤ä¸­åˆ·æ–°] triggerUpdate é€»æ™€');
                addToast()è‚¡åƒ¹æ›´æ–°é€¾æ™Šï¼Œç³»çµ±æœƒåœ¨ä¸‹ä¸€å€‹æœ‰æ•ˆé€±æœŸå†æ¨ªå¤–çš„ã®ã€', 'warning');
            } else {
                console.error('â™Œ [ç›¤ä¸­è‡ªå‹•åˆ¤æ–°å¤±æ•—:', error);
            }
            return false;
        } finally {
            isRunning.value = false;
        }
    };

    const evaluateMarketRefresh = ({ triggerImmediately = false } = {}) => {
        const context = getRefreshContext();
        if (!shouldScheduleMarketRefresh(context)) {
            stopActiveSchedule();
            return false;
        }

        if (refreshTimer) return true;

        refreshTimer = setInterval(() => {
            const intervalContext = getRefreshContext();
            if (!shouldScheduleMarketRefresh(intervalContext)) {
                stopActiveSchedule();
                return;
            }
            void triggerRefresh();
            updateNextTriggerTime();
        }, INTERVAL_MS);

        updateNextTriggerTime();
        startCountdown();

        if (triggerImmediately) {
            void triggerRefresh();
        }
        return true;
    };

    /**
     * å•Ÿå‹•ç¶£ä¸­åˆ·æ–°
     */
    const startMarketRefresh = () => {
        if (!checkTimer) {
            console.log('âœ¨ [ç›˜ä¸­åˆ·æ–°] ç³»çµ±å·²å•Ÿå‹•ï¼Œæ¯åˆ†é˜æ¤œæŸ¥æŽ’ç§å°ˆæ ¼');
            checkTimer = setInterval(() => {
                evaluateMarketRefresh({ triggerImmediately: true });
            }, 60 * 1000);
        }

        evaluateMarketRefresh({ triggerImmediately: true });
    };

    // æ ¼å¼åŒ–å€’æ•¸æ™²é–“
    const formattedTimeRemaining = () => {
        const minutes = Math.floor(timeRemaining.value / 60);
        const seconds = timeRemaining.value % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // æš®åœ/æ¢å¾©
    const togglePause = () => {
        isPaused.value = !isPaused.value;
        if (isPaused.value) {
            stopActiveSchedule();
            return;
        }
        evaluateMarketRefresh({ triggerImmediately: true });
    };

    const stopMarketRefresh = () => {
        stopActiveSchedule();
        if (checkTimer) {
            clearInterval(checkTimer);
            checkTimer = null;
        }
        console.log('âš¦ [ç›¤ä¸­è‡ªå‹•åˆ¤æ–°] ç³»çµ±å·²é—œé–‡');
    };

    const handleVisibilityChange = () => {
        if (!isPageVisible()) {
            stopActiveSchedule();
            return;
        }
        evaluateMarketRefresh({ triggerImmediately: true });
    };

    /**
     * æ‰‹å‹•è§£ç™¿ï¼ˆæ¸¬è©¦ç”¨ï¼Œä»å°ˆå®‹å®‹è‡ªå‹•åˆ·æ–°è·¨åˆ·ä»¶ ’â 4(€€€€€¨¼4(€€€½¹ÍÐµ…¹Õ…±QÉ¥•È€ô€ ¤€ôøì4(€€€€€€€½¹Í½±”¹±½œ ŸŠRPožn“’â·–"ßšZÁtƒš&/–.W¢žóžfóšnÓšZÀœ¤ì4(€€€€€€€Ù½¥ÑÉ¥•ÉI•™É•Í  ¤ì4(€€€ôì4(4(€€€Ý…Ñ   ¤€ôø…ÕÑ¡MÑ½É”¹Ñ½­•¸°€¡¹•ÝQ½­•¸¤€ôøì4(€€€€€€€¥˜€¡¹•ÝQ½­•¸€˜˜¥Í¹…‰±•¹Ù…±Õ”¤ì4(€€€€€€€€€€€ÍÑ…ÉÑ5…É­•ÑI•™É•Í  ¤ì4(€€€€€€€ô•±Í”ì4(€€€€€€€€€€€ÍÑ½Á5…É­•ÑI•™É•Í  ¤ì4(€€€€€€€ô4(€€€ô¤ì4(4(€€€Ý…Ñ ¡¥Í¹…‰±•°€¡•¹…‰±•¤€ôøì4(€€€€€€€¥˜€¡•¹…‰±•€˜˜…ÕÑ¡MÑ½É”¹Ñ½­•¸¤ì4(€€€€€€€€€€€ÍÑ…ÉÑ5…É­•ÑI•™É•Í  ¤ì4(€€€€€€€ô•±Í”ì4(€€€€€€€€€€€ÍÑ½Á5…É­•ÑI•™É•Í  ¤ì4(€€€€€€€ô4(€€€ô¤ì4(4(€€€½¹5½Õ¹Ñ•  ¤€ôøì4(€€€€€€€¥˜€¡ÑåÁ•½˜‘½Õµ•¹Ð€„ôô€Õ¹‘•™¥¹•œ¤ì4(€€€€€€€€€€€‘½Õµ•¹Ð¹…‘‘Ù•¹Ñ1¥ÍÑ•¹•È Ù¥Í¥‰¥±¥Ñå¡…¹”œ°¡…¹‘±•Y¥Í¥‰¥±¥Ñå¡…¹”¤ì4(€€€€€€€ô4(€€€€€€€¥˜€¡…ÕÑ¡MÑ½É”¹Ñ½­•¸€˜˜¥Í¹…‰±•¹Ù…±Õ”¤ì4(€€€€€€€€€€€ÍÑ…ÉÑ5…É­•ÑI•™É•Í  ¤ì4(€€€€€€€ô4(€€€ô¤ì4(4(€€€½¹U¹µ½Õ¹Ñ•  ¤€ôøì4(€€€€€€€¥˜€¡ÑåÁ•½˜‘½Õµ•¹Ð€„ôô€Õ¹‘•™¥¹•œ¤ì4(€€€€€€€€€€€‘½Õµ•¹Ð¹É•µ½Ù•Ù•¹Ñ1¥ÍÑ•¹•È Ù¥Í¥‰¥±¥Ñå¡…¹”œ°¡…¹‘±•Y¥Í¥‰¥±¥Ñå¡…¹”¤ì4(€€€€€€€ô4(€€€€€€€ÍÑ½Á5…É­•ÑI•™É•Í  ¤ì4(€€€ô¤ì4(4(€€€É•ÑÕÉ¸ì4(€€€€€€€¥Í¹…‰±•°4(€€€€€€€¥ÍIÕ¹¹¥¹œ°4(€€€€€€€¥ÍA…ÕÍ•°4(€€€€€€€±…ÍÑQÉ¥•ÉQ¥µ”°4(€€€€€€€¹•áÑQÉ¥•ÉQ¥µ”°4(€€€€€€€ÕÉÉ•¹Ñ5…É­•Ð°4(€€€€€€€Ñ¥µ•I•µ…¥¹¥¹œ°4(€€€€€€€¥Í5…É­•Ñ!½ÕÉÌ°4(€€€€€€€¥ÍQ]5…É­•Ñ=Á•¸°4(€€€€€€€¥ÍUM5…É­•Ñ=Á•¸°4(€€€€€€€¥Í…å±¥¡ÑM…Ù¥¹Q¥µ”°4(€€€€€€€™½Éµ…ÑÑ•‘Q¥µ•I•µ…¥¹¥¹œ°4(€€€€€€€Ñ½±•A…ÕÍ”°4(€€€€€€€ÍÑ…ÉÑ5…É­•ÑI•™É•Í °4(€€€€€€€ÍÑ½Á5…É­•ÑI•™É•Í °4(€€€€€€€µ…¹Õ…±QÉ¥•È4(€€€ôì4)ô4(