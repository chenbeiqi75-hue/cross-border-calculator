/**
 * 各银行跨境汇款费率配置
 *
 * buyRate / sellRate: 银行现汇买入价/卖出价（1 外币 = X 人民币）
 *   - null 表示未知，计算时使用市场中间价作为最佳估计
 *   - 用户应查询当日银行外汇牌价后填入实际数值
 *
 * 数据来源：用户对各行公开收费标准的核实
 */
import type { Bank } from './types'

const ALL_CURRENCIES = ['USD', 'HKD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'SGD', 'KRW', 'THB', 'CNY']

function defaultRates(
  feePercent: number,
  feeMinCNY: number,
  feeMaxCNY: number,
  telegraphFeeCNY: number,
  deductFromForeign: boolean,
): Record<string, {
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
    rates: defaultRates(0.001, 20, 200, 80, true),
  },
  {
    id: 'boc',
    name: '中国银行',
    rates: defaultRates(0.001, 50, 260, 150, false),
  },
  {
    id: 'icbc',
    name: '工商银行',
    rates: defaultRates(0.001, 20, 200, 100, false),
  },
  {
    id: 'ccb',
    name: '建设银行',
    rates: defaultRates(0.001, 20, 300, 80, false),
  },
  {
    id: 'cmb',
    name: '招商银行',
    rates: defaultRates(0.001, 100, 1000, 150, false),
  },
  {
    id: 'bcm',
    name: '交通银行',
    rates: defaultRates(0.001, 20, 250, 150, false),
  },
  {
    id: 'spdb',
    name: '浦发银行',
    rates: defaultRates(0.001, 50, 250, 80, false),
  },
]