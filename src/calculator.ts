import type { Bank, FormInputs, CalculationResult, TransferDirection, LockMode, BankRate } from './types'

/** 银行费用明细 */
export interface FeeBreakdown {
  /** 牌价标签，如"现汇卖出价 0.9230（价差 0.33%）" */
  rateLabel: string
  /** 手续费描述 */
  feeMinMaxLabel: string
  telegraphFeeCNY: number
  totalFeeCNY: number
  /** 锁定到账模式：需汇出金额 */
  requiredSendAmount?: number
}

/**
 * 计算各家银行的汇兑结果
 *
 * 牌价逻辑：
 *   send（人民币→外币）→ 银行现汇卖出价（银行卖外币给你）
 *   receive（外币→人民币）→ 银行现汇买入价（银行买你的外币）
 *
 *   sellRate / buyRate 存储格式：1 外币 = X 人民币
 *   midRate 格式：1 转出币种 = X 目标币种
 *   - send 时 midRate = 1 CNY = X 外币，bankRate = 1/sellRate
 *   - receive 时 midRate = 1 外币 = X CNY，bankRate = buyRate
 */
export function calculateAll(
  banks: Bank[],
  midRate: number,
  inputs: FormInputs,
  direction: TransferDirection,
  lockMode: LockMode,
): { result: CalculationResult; fee: FeeBreakdown }[] {
  const { amount, toCurrency } = inputs

  const results = banks
    .filter(b => b.rates[toCurrency]?.supported)
    .map(b => {
      const rate = b.rates[toCurrency]
      // 根据方向选牌价，单位统一到 midRate 的格式
      const bankRate = direction === 'send'
        ? (rate.sellRate != null ? 1 / rate.sellRate : midRate)
        : (rate.buyRate != null ? rate.buyRate : midRate)

      if (lockMode === 'sendAmount') {
        return forwardCalc(b.id, b.name, bankRate, midRate, amount, direction, rate)
      }
      return reverseCalc(b.id, b.name, bankRate, midRate, amount, direction, rate)
    })

  // 最优判定
  const bestFn = lockMode === 'sendAmount' ? Math.max : Math.min
  const bestVal = bestFn(...results.map(r =>
    lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? Infinity),
  ))

  results.forEach(r => {
    const val = lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? Infinity)
    r.result.isBest = val === bestVal
  })

  // 正向：到账降序；反向：需汇升序
  results.sort((a, b) =>
    lockMode === 'sendAmount'
      ? b.result.receivedAmount - a.result.receivedAmount
      : (a.fee.requiredSendAmount ?? Infinity) - (b.fee.requiredSendAmount ?? Infinity),
  )

  return results
}

/** 手续费计算（CNY 等值，含 min/max） */
function calcFeeCNY(
  amount: number,
  bankRate: number,
  rate: BankRate,
  direction: TransferDirection,
): { feeAmountCNY: number; telegraphCNY: number; totalCNY: number } {
  const amountCNY = direction === 'send' ? amount : amount * bankRate
  let feeAmountCNY = amountCNY * rate.feePercent
  if (rate.feeMinCNY > 0) feeAmountCNY = Math.max(rate.feeMinCNY, feeAmountCNY)
  if (rate.feeMaxCNY > 0) feeAmountCNY = Math.min(rate.feeMaxCNY, feeAmountCNY)
  return { feeAmountCNY, telegraphCNY: rate.telegraphFeeCNY, totalCNY: feeAmountCNY + rate.telegraphFeeCNY }
}

function forwardCalc(
  bankId: string, bankName: string,
  bankRate: number, midRate: number, amount: number,
  direction: TransferDirection, rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  const feeCNY = calcFeeCNY(amount, bankRate, rate, direction)
  let received: number
  if (direction === 'send') {
    received = rate.deductFromForeign
      ? Math.max(0, amount * bankRate - feeCNY.totalCNY / bankRate)
      : Math.max(0, amount - feeCNY.totalCNY) * bankRate
  } else {
    received = Math.max(0, amount - feeCNY.totalCNY / bankRate) * bankRate
  }
  return {
    result: { bankId, bankName, midRate, bankRate, totalFeeCNY: feeCNY.totalCNY, receivedAmount: received, isBest: false, savedComparedToWorst: 0 },
    fee: feeBreakdown(rate, feeCNY, midRate, direction),
  }
}

function reverseCalc(
  bankId: string, bankName: string,
  bankRate: number, midRate: number, target: number,
  direction: TransferDirection, rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  let requiredSend: number
  if (direction === 'send') {
    if (rate.deductFromForeign) {
      const est1 = (target + rate.telegraphFeeCNY / bankRate) / bankRate / (1 - rate.feePercent)
      const f1 = calcFeeCNY(est1, bankRate, rate, direction)
      requiredSend = (target + f1.totalCNY / bankRate) / bankRate
      const f2 = calcFeeCNY(requiredSend, bankRate, rate, direction)
      requiredSend = (target + f2.totalCNY / bankRate) / bankRate
    } else {
      const est1 = target / bankRate
      const f1 = calcFeeCNY(est1, bankRate, rate, direction)
      requiredSend = target / bankRate + f1.totalCNY
      const f2 = calcFeeCNY(requiredSend, bankRate, rate, direction)
      requiredSend = target / bankRate + f2.totalCNY
    }
  } else {
    const est1 = target / bankRate
    const f1 = calcFeeCNY(est1, bankRate, rate, direction)
    requiredSend = target / bankRate + f1.totalCNY / bankRate
    const f2 = calcFeeCNY(requiredSend, bankRate, rate, direction)
    requiredSend = target / bankRate + f2.totalCNY / bankRate
  }
  const finalFee = calcFeeCNY(requiredSend, bankRate, rate, direction)
  return {
    result: { bankId, bankName, midRate, bankRate, totalFeeCNY: finalFee.totalCNY, receivedAmount: target, isBest: false, savedComparedToWorst: 0 },
    fee: { ...feeBreakdown(rate, finalFee, midRate, direction), requiredSendAmount: Math.max(0, requiredSend) },
  }
}

function feeBreakdown(
  rate: BankRate,
  fee: { feeAmountCNY: number; telegraphCNY: number; totalCNY: number },
  midRate: number, direction: TransferDirection,
): FeeBreakdown {
  const priceType = direction === 'send' ? '现汇卖出价' : '现汇买入价'

  let displayedRate: number
  let spreadPct: number
  if (direction === 'send') {
    // 显示原始的卖出价（1 外币 = X 人民币）
    displayedRate = rate.sellRate ?? 1 / midRate
    spreadPct = rate.sellRate != null
      ? ((rate.sellRate - 1 / midRate) / (1 / midRate)) * 100
      : 0
  } else {
    displayedRate = rate.buyRate ?? midRate
    spreadPct = rate.buyRate != null
      ? ((midRate - rate.buyRate) / midRate) * 100
      : 0
  }

  const hasRate = direction === 'send' ? rate.sellRate != null : rate.buyRate != null
  const rateLabel = hasRate
    ? `${priceType} ${displayedRate.toFixed(6)} CNY/外币（价差 ${Math.abs(spreadPct).toFixed(2)}%）`
    : `使用市场中间价（未填银行牌价）`

  const capStr = rate.feeMinCNY > 0 || rate.feeMaxCNY > 0
    ? `（最低¥${rate.feeMinCNY}/最高¥${rate.feeMaxCNY > 0 ? rate.feeMaxCNY : '无'})`
    : ''

  return {
    rateLabel,
    feeMinMaxLabel: `${(rate.feePercent * 100).toFixed(2)}%${capStr}`,
    telegraphFeeCNY: rate.telegraphFeeCNY,
    totalFeeCNY: fee.totalCNY,
  }
}