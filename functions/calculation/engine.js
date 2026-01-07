// =========================================================================================
// == Calculation Engine (engine.js) - Main Orchestration Layer
// =========================================================================================

const { prepareEvents, getPortfolioStateOnDate, dailyValue } = require('./state.calculator');
const { calculateTwrHistory, calculateDailyPL, calculateDailyCashflows, calculateXIRR, createCashflowsForXirr } = require('./metrics.calculator');
const { toDate } = require('./helpers');

class CalculationEngine {
  constructor() {
    this.allEvents = [];
    this.market = {};
    this.startDate = null;
    this.endDate = null;
  }

  /**
   * Initialize the engine with market data, transactions, and events
   */
  initialize(transactions, splits, market, userDividends) {
    this.market = market;
    const { evts, firstBuyDate } = prepareEvents(transactions, splits, market, userDividends || []);
    this.allEvents = evts;
    this.startDate = firstBuyDate;
    this.endDate = new Date();
    return { success: true, eventsCount: evts.length, startDate: this.startDate };
  }

  /**
   * Calculate daily portfolio values and metrics
   */
  calculateDailyMetrics() {
    if (this.allEvents.length === 0) {
      return { dailyPortfolioValues: {}, dailyCashflows: {}, error: 'No events initialized' };
    }

    const dailyPortfolioValues = {};
    const dailyCashflows = calculateDailyCashflows(this.allEvents, this.market);
    const dateMap = new Set();

    // Collect all unique dates from events
    this.allEvents.forEach(e => {
      const dateStr = toDate(e.date).toISOString().split('T')[0];
      dateMap.add(dateStr);
    });

    // Also collect all dates from market data
    Object.keys(this.market).forEach(sym => {
      const prices = this.market[sym]?.prices || {};
      Object.keys(prices).forEach(dateStr => dateMap.add(dateStr));
    });

    // Calculate daily portfolio values
    const sortedDates = Array.from(dateMap).sort();
    for (const dateStr of sortedDates) {
      const date = new Date(dateStr);
      const state = getPortfolioStateOnDate(this.allEvents, date, this.market);
      const value = dailyValue(state, this.market, date, this.allEvents);
      dailyPortfolioValues[dateStr] = value;
    }

    return { dailyPortfolioValues, dailyCashflows };
  }

  /**
   * Calculate comprehensive metrics including TWR, XIRR, and performance
   */
  calculateMetrics(benchmarkSymbol = 'SPY') {
    if (this.allEvents.length === 0) {
      return { error: 'No events initialized' };
    }

    const { dailyPortfolioValues, dailyCashflows } = this.calculateDailyMetrics();
    
    // Calculate TWR
    const { twrHistory, benchmarkHistory } = calculateTwrHistory(
      dailyPortfolioValues,
      this.allEvents,
      this.market,
      benchmarkSymbol,
      this.startDate,
      dailyCashflows
    );

    // Calculate current portfolio state
    const currentDate = this.endDate || new Date();
    const currentState = getPortfolioStateOnDate(this.allEvents, currentDate, this.market);
    const currentPortfolioValue = dailyValue(currentState, this.market, currentDate, this.allEvents);

    // Calculate XIRR
    const xirrFlows = createCashflowsForXirr(this.allEvents, this._buildHoldingsSummary(currentState), this.market);
    const xirr = calculateXIRR(xirrFlows);

    // Calculate overall return
    const twrDates = Object.keys(twrHistory).sort();
    const latestTwr = twrDates.length > 0 ? twrHistory[twrDates[twrDates.length - 1]] : 0;

    return {
      twrHistory,
      benchmarkHistory,
      currentPortfolioValue,
      latestTWR: latestTwr,
      xirr: xirr ? (xirr * 100) : null,
      holdings: currentState,
      dailyPortfolioValues,
      dailyCashflows
    };
  }

  /**
   * Calculate daily P/L for a specific date
   */
  calculateDailyChange(date = new Date()) {
    const today = toDate(date);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    return calculateDailyPL(today, yesterday, this.allEvents, this.market);
  }

  /**
   * Get portfolio state at a specific date
   */
  getPortfolioAtDate(date) {
    return getPortfolioStateOnDate(this.allEvents, toDate(date), this.market);
  }

  /**
   * Get portfolio value at a specific date
   */
  getPortfolioValueAtDate(date) {
    const state = this.getPortfolioAtDate(date);
    return dailyValue(state, this.market, toDate(date), this.allEvents);
  }

  /**
   * Helper function to build holdings summary for XIRR calculation
   */
  _buildHoldingsSummary(state) {
    const holdings = {};
    Object.keys(state).forEach(sym => {
      const s = state[sym];
      const qty = s.lots.reduce((sum, lot) => sum + lot.quantity, 0);
      const totalCost = s.lots.reduce((sum, lot) => sum + lot.quantity * lot.pricePerShareTWD, 0);
      holdings[sym] = {
        symbol: sym,
        quantity: qty,
        totalCostTWD: totalCost,
        marketValueTWD: 0
      };
    });
    return holdings;
  }

  /**
   * Validate event data
   */
  validateEvents() {
    const issues = [];
    this.allEvents.forEach((e, idx) => {
      if (!e.date) issues.push(`Event ${idx}: Missing date`);
      if (!e.symbol) issues.push(`Event ${idx}: Missing symbol`);
      if (e.eventType === 'transaction' && !e.type) issues.push(`Event ${idx}: Missing transaction type`);
    });
    return { valid: issues.length === 0, issues };
  }
}

module.exports = CalculationEngine;
