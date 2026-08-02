/** 币种 */
export interface Currency {
  code: string
  name: string
  symbol: string
}

/** 银行费率配置 */
export interface BankRate {
  /** 手续费：按比例（如 0.001 = 0.1%） */
  feePercent: number
  /** 手续费：固定金额（人民币，CNY） */
  feeFixedCNY: number
  /** 电报费/电讯费（人民币） */
  telegraphFeeCNY: number
  /** 汇率加点（相对于中间价的百分比偏移，正=加价，负=折价） */
  spreadPercent: number
  /** 是否支持该币种 */
  supported: boolean
}

/** 银行信息 */
export interface Bank {
  id: string
  name: string
  /** 币种 → 费率 */
  rates: Record<string, BankRate>
}

/** 计算结果（单家银行） */
export interface CalculationResult {
  bankId: string
  bankName: string
  /** 中间价 */
  midRate: number
  /** 银行实际汇率 */
  bankRate: number
  /** 手续费总额（人民币） */
  totalFeeCNY: number
  /** 到账金额（目标币种） */
  receivedAmount: number
  /** 是否最低到账 */
  isBest: boolean
  /** 比最高节省 */
  savedComparedToWorst: number
}

/** 方向：汇款还是汇回 */
export type TransferDirection = 'send' | 'receive'

/** 表单输入 */
export interface FormInputs {
  amount: number
  fromCurrency: string
  toCurrency: string
}

/** 锁定模式：锁定转出金额（算能收到多少）还是锁定到账金额（算需要汇多少） */
export type LockMode = 'sendAmount' | 'receiveAmount'