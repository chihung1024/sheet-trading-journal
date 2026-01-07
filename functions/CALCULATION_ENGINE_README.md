# Calculation Engine - Architecture & Implementation Guide

## Overview

The sheet-trading-journal calculation engine is a sophisticated portfolio analysis system inspired by the portfolio-journal project. It implements advanced financial metrics calculations including Time-Weighted Returns (TWR), Internal Rate of Return (XIRR), and comprehensive position tracking.

## Architecture

The calculation engine consists of four core modules:

### 1. helpers.js
Utility functions for common calculations:
- `toDate(v)` - Safely convert values to Date objects
- `isTwStock(symbol)` - Identify Taiwan-listed stocks
- `getTotalCost(tx)` - Calculate transaction cost
- `findNearest(hist, date)` - Find nearest historical price data
- `findFxRate(market, currency, date)` - Currency conversion rates

### 2. state.calculator.js
Portfolio state management and tracking:
- `prepareEvents()` - Combine and sort all events (transactions, splits, dividends)
- `getPortfolioStateOnDate(allEvts, targetDate, market)` - Get holdings state at specific date
- `dailyValue(state, market, date)` - Calculate portfolio value with split adjustments

**Key Features:**
- FIFO lot tracking for cost basis
- Support for long and short positions
- Automatic split ratio adjustments
- Multi-currency support with forex conversion

### 3. metrics.calculator.js
Advanced financial metrics:
- `calculateTwrHistory()` - Time-Weighted Return calculation
- `calculateDailyPL()` - Daily profit/loss
- `calculateDailyCashflows()` - Track cash movements
- `calculateXIRR()` - Internal Rate of Return (Newton-Raphson method)
- `createCashflowsForXirr()` - Format flows for XIRR calculation

**Key Features:**
- Robust TWR with benchmark comparison
- Daily cash flow tracking
- XIRR using iterative numerical methods
- Dividend handling (confirmed and implicit)

### 4. engine.js
Main orchestration layer (CalculationEngine class):
```javascript
const engine = new CalculationEngine();
engine.initialize(transactions, splits, market, userDividends);
const metrics = engine.calculateMetrics('SPY');
```

**Public Methods:**
- `initialize(txs, splits, market, dividends)` - Setup engine
- `calculateMetrics(benchmark)` - Comprehensive analysis
- `calculateDailyMetrics()` - Daily values and cashflows
- `calculateDailyChange(date)` - Daily P/L
- `getPortfolioAtDate(date)` - Holdings snapshot
- `getPortfolioValueAtDate(date)` - Value at specific date
- `validateEvents()` - Data validation

## Data Structures

### Transaction Event
```javascript
{
  date: Date,
  symbol: "AAPL",
  type: "buy" | "sell",
  quantity: 100,
  price: 150.50,
  totalCost: 15050,
  currency: "USD",
  exchangeRate: 30.5
}
```

### Market Data
```javascript
{
  "AAPL": {
    prices: {
      "2024-01-01": 150.50,
      "2024-01-02": 151.20
    },
    dividends: {
      "2024-03-15": 0.25
    },
    currency: "USD"
  },
  "TWD=X": {
    rates: {
      "2024-01-01": 30.5,
      "2024-01-02": 30.6
    }
  }
}
```

### Portfolio State
```javascript
{
  "AAPL": {
    lots: [
      {
        quantity: 100,
        pricePerShareTWD: 4600,
        pricePerShareOriginal: 150.50,
        date: Date
      }
    ],
    currency: "USD",
    realizedPLTWD: 500
  }
}
```

## Calculation Methods

### Time-Weighted Return (TWR)
Measures investment performance independent of cash flow timing:
```
TWR = (Product of Period Returns) - 1
Period Return = (Market Value End - Cash Flow) / Market Value Beginning
```

### Internal Rate of Return (XIRR)
Solves for IRR where NPV = 0:
```
NPV = Sum(Cashflow / (1 + XIRR)^(Year))
```
Uses Newton-Raphson iteration method.

### Daily P/L
Calculates change based on position value and cash flows:
```
Daily P/L = Ending Value - Beginning Value - Daily Cashflows
```

## Multi-Currency Support

The engine automatically converts all values to TWD (Taiwan Dollar):
- Supported currencies: USD, HKD, JPY, TWD
- Uses forex rates from market data
- Applied to both positions and cash flows
- Tax adjustments for US dividends (30% withholding tax)

## Integration with Google Sheets

Designed to integrate with Google Sheets API:
1. Read transaction data from sheets
2. Pull market prices from external APIs
3. Calculate metrics
4. Write results back to sheets

## Error Handling

- Missing data handled with default values
- Infinite/NaN checks in calculations
- Event validation with `validateEvents()`
- Tolerance handling for date/price lookups

## Performance Considerations

- O(n) complexity for most calculations
- O(n²) for TWR calculation due to daily iteration
- Event sorting once at initialization
- Lazy evaluation of positions

## Testing

Key test scenarios:
1. Single stock buy and sell
2. Multiple transactions with different currencies
3. Stock splits with price adjustments
4. Dividend handling (confirmed and implicit)
5. Benchmark comparison
6. XIRR convergence

## Future Enhancements

- Options and derivatives support
- Tax-lot tracking with wash sale rules
- Real-time streaming prices
- Advanced performance attribution
- Backtesting framework
- Risk metrics (Sharpe ratio, Sortino ratio)
