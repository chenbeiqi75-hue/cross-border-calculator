/** 币种 */
export interface Currency {
  code: string
  name: string
  symbol: string
}

/** 银行费率配置（同一银行不同币种费率不同） */
export interface BankRate {
  /** 汇率加点百分比（如 2.0 = 银行比中间价贵 2%） */
  spreadPercent: number
  /** 手续费比例（如 0.001 = 0.1%） */
  feePercent: number
  /** 手续费最低收费（折合人民币） */
  feeMinCNY: number
  /** 手续费最高收费（折合人民币，0 = 无上限） */
  feeMaxCNY: number
  /** 电报费/电讯费（折合人民币） */
  telegraphFeeCNY: number
  /** 费用是否以汇款币种收取（true=从外币扣，false=从人民币扣） */
  deductFromForeign: boolean
  /** 是否支持该币种 */
  supported: boolean
}

/** 银行信息 */
export interface Bank {
  id: string
  name: string
  /** 目标币种代码 → 费率 */
  rates: Record<string, BankRate>
}

/** 计算结果（单家银行） */
export interface CalculationResult {
  bankId: string
  bankName: string
  /** 中间价：1 转出币种 = X 目标币种 */
  midRate: number
  /** 银行实际汇率（加点后） */
  bankRate: number
  /** 手续费总额（折合人民币） */
  totalFeeCNY: number
  /** 到账金额（目标币种） */
  receivedAmount: number
  /** 是否最优 */
  isBest: boolean
  /** 比最差节省（折合人民币） */
  savedComparedToWorst: number
}

/** 方向 */
export type TransferDirection = 'send' | 'receive'

/** 表单输入 */
export interface FormInputs {
  amount: number
  fromCurrency: string
  toCurrency: string
}

/** 锁定模式 */
export type LockMode = 'sendAmount' | 'receiveAmount'