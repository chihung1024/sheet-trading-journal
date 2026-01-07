// =========================================================================================
// == Core Metrics Calculator (metrics.calculator.js) - v4.1
// =========================================================================================

const { toDate, isTwStock, getTotalCost, findNearest, findFxRate } = require('./helpers');
const { getPortfolioStateOnDate } = require('./state.calculator');

/**
 * Calculate Time-Weighted Return (TWR) history
 */
function calculateTwrHistory(dailyPortfolioValues, evts, market, benchmarkSymbol, startDate, dailyCashflows, log = console.log) {
  const dates = Object.keys(dailyPortfolioValues).sort();
  if (!startDate || dates.length === 0) return { twrHistory: {}, benchmarkHistory: {} };
  
  const upperBenchmarkSymbol = benchmarkSymbol.toUpperCase();
  const benchmarkPrices = market[upperBenchmarkSymbol]?.prices || {};
  if (Object.keys(benchmarkPrices).length === 0) {
    log(`TWR_CALC_WARN: Benchmark ${upperBenchmarkSymbol} lacks historical price data.`);
    return { twrHistory: {}, benchmarkHistory: {} };
  }
  
  const benchmarkCurrency = isTwStock(upperBenchmarkSymbol) ? 'TWD' : 'USD';
  const startFxRate = findFxRate(market, benchmarkCurrency, startDate);
  const benchmarkStartPriceInfo = findNearest(benchmarkPrices, startDate);
  if (!benchmarkStartPriceInfo) {
    log(`TWR_CALC_FAIL: Cannot find start price for benchmark ${upperBenchmarkSymbol}.`);
    return { twrHistory: {}, benchmarkHistory: {} };
  }
  
  const benchmarkStartPriceOriginal = benchmarkStartPriceInfo.value;
  const benchmarkStartPriceTWD = benchmarkStartPriceOriginal * startFxRate;
  const twrHistory = {};
  const benchmarkHistory = {};
  let cumulativeHpr = 1.0;
  let lastMarketValue = 0.0;
  
  for (const dateStr of dates) {
    const MVE = dailyPortfolioValues[dateStr];
    const CF = dailyCashflows[dateStr] || 0;
    const MVB = lastMarketValue;
    let periodHprFactor = 1.0;
    
    if (MVB > 1e-9) {
      periodHprFactor = (MVE - CF) / MVB;
    } else if (CF > 1e-9) {
      periodHprFactor = MVE / CF;
    }
    
    if (!isFinite(periodHprFactor)) {
      periodHprFactor = 1.0;
    }
    
    cumulativeHpr *= periodHprFactor;
    twrHistory[dateStr] = (cumulativeHpr - 1) * 100;
    lastMarketValue = MVE;
    
    const currentBenchPriceInfo = findNearest(benchmarkPrices, new Date(dateStr));
    if (currentBenchPriceInfo && benchmarkStartPriceTWD > 0) {
      const currentBenchPriceOriginal = currentBenchPriceInfo.value;
      const currentFxRate = findFxRate(market, benchmarkCurrency, new Date(dateStr));
      benchmarkHistory[dateStr] = ((currentBenchPriceOriginal * currentFxRate / benchmarkStartPriceTWD) - 1) * 100;
    }
  }
  
  return { twrHistory, benchmarkHistory };
}

/**
 * Calculate daily P/L for a specific date
 */
function calculateDailyPL(today, yesterday, allEvts, market) {
  const stateYesterday = getPortfolioStateOnDate(allEvts, yesterday, market);
  let beginningMarketValueTWD = 0;
  
  for (const sym in stateYesterday) {
    const h = stateYesterday[sym];
    const qty_start_of_day = h.lots.reduce((s, l) => s + l.quantity, 0);
    if (Math.abs(qty_start_of_day) > 1e-9) {
      const priceInfo = findNearest(market[sym]?.prices, yesterday);
      if (priceInfo) {
        const priceBefore = priceInfo.value;
        const fx = findFxRate(market, h.currency, yesterday);
        beginningMarketValueTWD += qty_start_of_day * priceBefore * (h.currency === 'TWD' ? 1 : fx);
      }
    }
  }
  
  const stateToday = getPortfolioStateOnDate(allEvts, today, market);
  let endingMarketValueTWD = 0;
  
  for (const sym in stateToday) {
    const h = stateToday[sym];
    const qty_end_of_day = h.lots.reduce((s, l) => s + l.quantity, 0);
    if (Math.abs(qty_end_of_day) > 1e-9) {
      const priceInfo = findNearest(market[sym]?.prices, today);
      if (priceInfo) {
        const priceToday = priceInfo.value;
        const fx = findFxRate(market, h.currency, today);
        endingMarketValueTWD += qty_end_of_day * priceToday * (h.currency === 'TWD' ? 1 : fx);
      }
    }
  }
  
  let dailyCashFlowTWD = 0;
  const todaysEvents = allEvts.filter(e => toDate(e.date).getTime() === today.getTime());
  
  for (const e of todaysEvents) {
    if (e.eventType === 'transaction') {
      const fx = findFxRate(market, e.currency, toDate(e.date));
      const costTWD = getTotalCost(e) * (e.currency === 'TWD' ? 1 : fx);
      dailyCashFlowTWD += (e.type === 'buy' ? costTWD : -costTWD);
    } else if (e.eventType === 'confirmed_dividend' || e.eventType === 'implicit_dividend') {
      let dividendAmountTWD = 0;
      if (e.eventType === 'confirmed_dividend') {
        const fx = findFxRate(market, e.currency, toDate(e.date));
        dividendAmountTWD = e.amount * (e.currency === 'TWD' ? 1 : fx);
      } else {
        const stateOnExDate = getPortfolioStateOnDate(allEvts, toDate(e.ex_date), market);
        const shares = stateOnExDate[e.symbol.toUpperCase()]?.lots.reduce((sum, lot) => sum + lot.quantity, 0) || 0;
        if (shares > 0) {
          const currency = stateOnExDate[e.symbol.toUpperCase()]?.currency || 'USD';
          const fx = findFxRate(market, currency, toDate(e.date));
          const postTaxAmount = e.amount_per_share * (1 - (isTwStock(e.symbol) ? 0.0 : 0.30));
          dividendAmountTWD = postTaxAmount * shares * (currency === 'TWD' ? 1 : fx);
        }
      }
      dailyCashFlowTWD -= dividendAmountTWD;
    }
  }
  
  return endingMarketValueTWD - beginningMarketValueTWD - dailyCashFlowTWD;
}

function calculateDailyCashflows(evts, market) {
  return evts.reduce((acc, e) => {
    const dateStr = toDate(e.date).toISOString().split('T')[0];
    let flow = 0;
    
    if (e.eventType === 'transaction') {
      const currency = e.currency || 'USD';
      const fx = (e.exchangeRate && currency !== 'TWD') ? e.exchangeRate : findFxRate(market, currency, toDate(e.date));
      flow = (e.type === 'buy' ? 1 : -1) * getTotalCost(e) * (currency === 'TWD' ? 1 : fx);
    } else if (e.eventType === 'confirmed_dividend' || e.eventType === 'implicit_dividend') {
      let dividendAmountTWD = 0;
      if (e.eventType === 'confirmed_dividend') {
        const fx = findFxRate(market, e.currency, toDate(e.date));
        dividendAmountTWD = e.amount * (e.currency === 'TWD' ? 1 : fx);
      } else {
        const stateOnDate = getPortfolioStateOnDate(evts, toDate(e.ex_date), market);
        const shares = stateOnDate[e.symbol.toUpperCase()]?.lots.reduce((s, l) => s + l.quantity, 0) || 0;
        if (shares > 0) {
          const currency = stateOnDate[e.symbol.toUpperCase()]?.currency || 'USD';
          const fx = findFxRate(market, currency, toDate(e.date));
          const postTaxAmount = e.amount_per_share * (1 - (isTwStock(e.symbol) ? 0.0 : 0.30));
          dividendAmountTWD = postTaxAmount * shares * (currency === 'TWD' ? 1 : fx);
        }
      }
      flow = -1 * dividendAmountTWD;
    }
    
    if (flow !== 0) acc[dateStr] = (acc[dateStr] || 0) + flow;
    return acc;
  }, {});
}

function calculateXIRR(flows) {
  if (flows.length < 2) return null;
  const amounts = flows.map(f => f.amount);
  if (!amounts.some(v => v < 0) || !amounts.some(v => v > 0)) return null;
  
  const dates = flows.map(f => f.date);
  const epoch = dates[0].getTime();
  const years = dates.map(d => (d.getTime() - epoch) / (365.25 * 24 * 60 * 60 * 1000));
  
  let guess = 0.1;
  let npv;
  for (let i = 0; i < 50; i++) {
    npv = amounts.reduce((sum, amount, j) => sum + amount / Math.pow(1 + guess, years[j]), 0);
    if (Math.abs(npv) < 1e-6) return guess;
    const derivative = amounts.reduce((sum, amount, j) => sum - years[j] * amount / Math.pow(1 + guess, years[j] + 1), 0);
    if (Math.abs(derivative) < 1e-9) break;
    guess -= npv / derivative;
  }
  return (npv && Math.abs(npv) < 1e-6) ? guess : null;
}

function createCashflowsForXirr(evts, holdings, market) {
  const flows = [];
  evts.forEach(e => {
    let amt = 0;
    let flowDate = toDate(e.date);
    if (e.eventType === 'transaction') {
      const currency = e.currency || 'USD';
      const fx = (e.exchangeRate && currency !== 'TWD') ? e.exchangeRate : findFxRate(market, currency, flowDate);
      amt = (e.type === 'buy' ? -getTotalCost(e) : getTotalCost(e)) * (currency === 'TWD' ? 1 : fx);
    } else if (e.eventType === 'confirmed_dividend') {
      const fx = findFxRate(market, e.currency, flowDate);
      amt = e.amount * (e.currency === 'TWD' ? 1 : fx);
    } else if (e.eventType === 'implicit_dividend') {
      const stateOnDate = getPortfolioStateOnDate(evts, toDate(e.ex_date), market);
      const sym = e.symbol.toUpperCase();
      const shares = stateOnDate[sym]?.lots.reduce((s, l) => s + l.quantity, 0) || 0;
      if (shares > 0) {
        const currency = stateOnDate[sym]?.currency || 'USD';
        const fx = findFxRate(market, currency, flowDate);
        const postTaxAmount = e.amount_per_share * (1 - (isTwStock(sym) ? 0.0 : 0.30));
        amt = postTaxAmount * shares * (currency === 'TWD' ? 1 : fx);
      }
    }
    if (Math.abs(amt) > 1e-6) {
      flows.push({ date: flowDate, amount: amt });
    }
  });
  
  const totalMarketValue = Object.values(holdings).reduce((s, h) => s + h.marketValueTWD, 0);
  if (Math.abs(totalMarketValue) > 0) {
    flows.push({ date: new Date(), amount: totalMarketValue });
  }
  
  const combined = flows.reduce((acc, flow) => {
    const dateStr = flow.date.toISOString().slice(0, 10);
    acc[dateStr] = (acc[dateStr] || 0) + flow.amount;
    return acc;
  }, {});
  
  return Object.entries(combined)
    .filter(([, amount]) => Math.abs(amount) > 1e-6)
    .map(([date, amount]) => ({ date: new Date(date), amount }))
    .sort((a, b) => a.date - b.date);
}

module.exports = {
  calculateTwrHistory,
  calculateDailyPL,
  calculateDailyCashflows,
  calculateXIRR,
  createCashflowsForXirr
};
