/**
 * 各银行跨境汇款费率配置
 *
 * estimatedSpreadPct: 银行典型汇差（基于行业调研）
 *   - 大型国有银行：约 0.5%-0.8%
 *   - 股份制银行：约 0.8%-1.2%
 *
 * 用户可填入当日实际的 buyRate/sellRate 代替估算。
 * 当未填时，系统会自动用 estimatedSpreadPct × 中间价 计算。
 */
import type { Bank } from './types'

const ALL_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'KRW', 'THB', 'CNY']

function defaultRates(
  estimatedSpreadPct: number,
  feePercent: number,
  feeMinCNY: number,
  feeMaxCNY: number,
  telegraphFeeCNY: number,
  deductFromForeign: boolean,
): Record<string, {
  estimatedSpreadPct: number
  sellRate: number | null
  buyRate: number | null
  feePercent: number
  feeMinCNY: number
  feeMaxCNY: number
  telegraphFeeCNY: number
  deductFromForeign: boolean
  supported: boolean
}> {
  const rates: Record<string, any> = {}
  for (const code of ALL_CURRENCIES) {
    rates[code] = {
      estimatedSpreadPct,
      sellRate: null,
      buyRate: null,
      feePercent,
      feeMinCNY,
      feeMaxCNY,
      telegraphFeeCNY,
      deductFromForeign,
      supported: true,
    }
  }
  return rates
}

export const DEFAULT_BANKS: Bank[] = [
  {
    id: 'abc',
    name: '农业银行',
    rates: defaultRates(0.6, 0.001, 20, 200, 80, true),
  },
  {
    id: 'boc',
    name: '中国银行',
    rates: defaultRates(0.5, 0.001, 50, 260, 150, false),
  },
  {
    id: 'icbc',
    name: '工商银行',
    rates: defaultRates(0.7, 0.001, 20, 200, 100, false),
  },
  {
    id: 'ccb',
    name: '建设银行',
    rates: defaultRates(0.6, 0.001, 20, 300, 80, false),
  },
  {
    id: 'cmb',
    name: '招商银行',
    rates: defaultRates(1.0, 0.001, 100, 1000, 150, false),
  },
  {
    id: 'bcm',
    name: '交通银行',
    rates: defaultRates(0.8, 0.001, 20, 250, 150, false),
  },
  {
    id: 'spdb',
    name: '浦发银行',
    rates: defaultRates(0.8, 0.001, 50, 250, 80, false),
  },
]