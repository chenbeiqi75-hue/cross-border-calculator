/**
 * 各银行跨境汇款费率默认配置
 *
 * 数据来源与说明：
 * - 农业银行：按实际公布费率（0.1%，最低20最高200，电报费80，费用以外币收取）
 * - 其他银行：基于行业典型值，用户可编辑更正
 *
 * feeMinCNY / feeMaxCNY: 手续费人民币等值最低/最高限额（0=无上限）
 * deductFromForeign: true=费用从外币端扣（农行等），false=从人民币端扣
 */
import type { Bank } from './types'

const ALL_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'KRW', 'THB', 'CNY']

function defaultRates(
  spreadPercent: number,
  feePercent: number,
  feeMinCNY: number,
  feeMaxCNY: number,
  telegraphFeeCNY: number,
  deductFromForeign: boolean,
): Record<string, { spreadPercent: number; feePercent: number; feeMinCNY: number; feeMaxCNY: number; telegraphFeeCNY: number; deductFromForeign: boolean; supported: boolean }> {
  const rates: Record<string, any> = {}
  for (const code of ALL_CURRENCIES) {
    rates[code] = { spreadPercent, feePercent, feeMinCNY, feeMaxCNY, telegraphFeeCNY, deductFromForeign, supported: true }
  }
  return rates
}

export const DEFAULT_BANKS: Bank[] = [
  {
    id: 'abc',
    name: '农业银行',
    rates: defaultRates(2.0, 0.001, 20, 200, 80, true),
  },
  {
    id: 'boc',
    name: '中国银行',
    rates: defaultRates(2.0, 0.001, 50, 260, 150, false),
  },
  {
    id: 'icbc',
    name: '工商银行',
    rates: defaultRates(2.5, 0.001, 20, 200, 100, false),
  },
  {
    id: 'ccb',
    name: '建设银行',
    rates: defaultRates(2.0, 0.001, 20, 300, 80, false),
  },
  {
    id: 'cmb',
    name: '招商银行',
    rates: defaultRates(3.0, 0.001, 100, 1000, 150, false),
  },
  {
    id: 'bcm',
    name: '交通银行',
    rates: defaultRates(2.0, 0.001, 20, 250, 150, false),
  },
  {
    id: 'spdb',
    name: '浦发银行',
    rates: defaultRates(2.5, 0.001, 50, 250, 80, false),
  },
]