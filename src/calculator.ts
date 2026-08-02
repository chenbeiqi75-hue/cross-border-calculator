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
 *   当用户未填入实际牌价时，使用 estimatedSpreadPct 从中间价推导。
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
      // 计算实际使用的银行汇率
      const bankRate = computeBankRate(rate, midRate, direction)

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

/** 根据方向计算银行实际汇率，牌价未知时用估算价差 */
function computeBankRate(rate: BankRate, midRate: number, direction: TransferDirection): number {
  if (direction === 'send') {
    // 卖出价：1 外币 = sellRate CNY → bankRate = 1/sellRate（1 CNY = X 外币）
    if (rate.sellRate != null) return 1 / rate.sellRate
    // 未填：用价差估算，银行卖得比中间价贵
    return midRate / (1 + rate.estimatedSpreadPct / 100)
  } else {
    // 买入价：1 外币 = buyRate CNY → bankRate = buyRate（单位一致）
    if (rate.buyRate != null) return rate.buyRate
    // 未填：用价差估算，银行买得比中间价便宜
    return midRate * (1 - rate.estimatedSpreadPct / 100)
  }
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
  const hasActualRate = direction === 'send' ? rate.sellRate != null : rate.buyRate != null

  let displayedRate: number
  let spreadPct: number

  if (direction === 'send') {
    displayedRate = rate.sellRate != null ? rate.sellRate : (1 / midRate) * (1 + rate.estimatedSpreadPct / 100)
    const midCnyRate = 1 / midRate
    spreadPct = rate.sellRate != null
      ? ((rate.sellRate - midCnyRate) / midCnyRate) * 100
      : rate.estimatedSpreadPct
  } else {
    displayedRate = rate.buyRate != null ? rate.buyRate : midRate * (1 - rate.estimatedSpreadPct / 100)
    spreadPct = rate.buyRate != null
      ? ((midRate - rate.buyRate) / midRate) * 100
      : rate.estimatedSpreadPct
  }

  const rateLabel = hasActualRate
    ? `${priceType} ${displayedRate.toFixed(6)} CNY/外币（价差 ${Math.abs(spreadPct).toFixed(2)}%）`
    : `估算 ${priceType} ${displayedRate.toFixed(6)} CNY/外币（估算价差 ${spreadPct.toFixed(2)}%）`

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