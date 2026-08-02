import type { Bank, FormInputs, CalculationResult, TransferDirection, LockMode, BankRate } from './types'

/** 银行费用明细 */
export interface FeeBreakdown {
  rateLabel: string
  feePercentLabel: string
  telegraphFeeCNY: number
  totalFeeCNY: number
  /** 锁定到账金额模式：需要汇出多少 */
  requiredSendAmount?: number
}

/**
 * 计算每家银行的汇兑结果
 *
 * 核心汇率逻辑：
 *   midRate = 1 转出币种 = X 目标币种（中间价，无加点）
 *   bankRate = midRate / (1 + spreadPercent/100) — 银行加点，客户拿到更差汇率
 *   - send 方向：CNY → 外币，bankRate = 1 CNY = X 外币（银行卖出价）
 *   - receive 方向：外币 → CNY，bankRate = 1 外币 = X CNY（银行买入价）
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
      const bankRate = midRate / (1 + rate.spreadPercent / 100)

      if (lockMode === 'sendAmount') {
        return forwardCalc(b, bankRate, midRate, amount, direction, rate)
      }
      return reverseCalc(b, bankRate, midRate, amount, direction, rate)
    })

  // 最优判定
  const bestFn = lockMode === 'sendAmount' ? Math.max : Math.min
  const bestVal = bestFn(
    ...results.map(r =>
      lockMode === 'sendAmount'
        ? r.result.receivedAmount
        : (r.fee.requiredSendAmount ?? Infinity),
    ),
  )

  results.forEach(r => {
    const val = lockMode === 'sendAmount'
      ? r.result.receivedAmount
      : (r.fee.requiredSendAmount ?? Infinity)
    r.result.isBest = val === bestVal
  })

  // 正向：到账降序（多→少）；反向：需汇升序（少→多）
  results.sort((a, b) =>
    lockMode === 'sendAmount'
      ? b.result.receivedAmount - a.result.receivedAmount
      : (a.fee.requiredSendAmount ?? Infinity) - (b.fee.requiredSendAmount ?? Infinity),
  )

  return results
}

function forwardCalc(
  bank: Bank,
  bankRate: number,
  midRate: number,
  amount: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  const fixedFeeCNY = rate.feeFixedCNY + rate.telegraphFeeCNY

  let totalFeeCNY: number
  let receivedAmount: number

  if (direction === 'send') {
    // 汇款出去：amount CNY，从中扣手续费/电报费，剩余按 bankRate 兑外币
    totalFeeCNY = amount * rate.feePercent + fixedFeeCNY
    const amountAfterFee = Math.max(0, amount - totalFeeCNY)
    receivedAmount = amountAfterFee * bankRate   // 1 CNY = bankRate 外币
  } else {
    // 汇回国内：amount 外币，从中扣手续费/电报费，剩余按 bankRate 兑 CNY
    const feeInForeign = amount * rate.feePercent + fixedFeeCNY / bankRate
    const amountAfterFee = Math.max(0, amount - feeInForeign)
    receivedAmount = amountAfterFee * bankRate   // 1 外币 = bankRate CNY
    totalFeeCNY = feeInForeign * bankRate
  }

  return {
    result: {
      bankId: bank.id,
      bankName: bank.name,
      midRate,
      bankRate,
      totalFeeCNY: Math.max(0, totalFeeCNY),
      receivedAmount: Math.max(0, receivedAmount),
      isBest: false,
      savedComparedToWorst: 0,
    },
    fee: {
      rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
      feePercentLabel: `${(rate.feePercent * 100).toFixed(2)}%`,
      telegraphFeeCNY: rate.telegraphFeeCNY,
      totalFeeCNY: Math.max(0, totalFeeCNY),
    },
  }
}

function reverseCalc(
  bank: Bank,
  bankRate: number,
  midRate: number,
  target: number,
  direction: TransferDirection,
  rate: BankRate,
): { result: CalculationResult; fee: FeeBreakdown } {
  const fixedFeeCNY = rate.feeFixedCNY + rate.telegraphFeeCNY

  let requiredSend: number
  let totalFeeCNY: number

  if (direction === 'send') {
    // 目标：收到 target 外币。需要汇多少 CNY？
    // target = (requiredSend - 手续费 - 电报费) * bankRate
    // target = (requiredSend * (1 - feePercent) - fixedFeeCNY) * bankRate
    // requiredSend = (target / bankRate + fixedFeeCNY) / (1 - feePercent)
    requiredSend = (target / bankRate + fixedFeeCNY) / (1 - rate.feePercent)
    totalFeeCNY = requiredSend * rate.feePercent + fixedFeeCNY
  } else {
    // 目标：收到 target CNY。需要汇多少 外币？
    // target = (requiredSend - 手续费外币 - 电报费外币) * bankRate
    // target = (requiredSend * (1 - feePercent) - fixedFeeCNY/bankRate) * bankRate
    // target = requiredSend * bankRate * (1 - feePercent) - fixedFeeCNY
    // requiredSend = (target + fixedFeeCNY) / (bankRate * (1 - feePercent))
    requiredSend = (target + fixedFeeCNY) / (bankRate * (1 - rate.feePercent))
    totalFeeCNY = requiredSend * rate.feePercent + fixedFeeCNY
  }

  return {
    result: {
      bankId: bank.id,
      bankName: bank.name,
      midRate,
      bankRate,
      totalFeeCNY: Math.max(0, totalFeeCNY),
      receivedAmount: target,
      isBest: false,
      savedComparedToWorst: 0,
    },
    fee: {
      rateLabel: `${rate.spreadPercent.toFixed(1)}% 加点`,
      feePercentLabel: `${(rate.feePercent * 100).toFixed(2)}%`,
      telegraphFeeCNY: rate.telegraphFeeCNY,
      totalFeeCNY: Math.max(0, totalFeeCNY),
      requiredSendAmount: Math.max(0, requiredSend),
    },
  }
}