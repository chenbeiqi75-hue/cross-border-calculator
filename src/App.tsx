import { useState, useCallback } from 'react'
import type { Bank, CalculationResult, TransferDirection, LockMode } from './types'
import { currencies, getCurrencySymbol } from './currencies'
import { DEFAULT_BANKS } from './bankRates'
import { getMidRate } from './exchangeRate'
import { calculateAll, type FeeBreakdown } from './calculator'
import './App.css'

const DIRECTION_LABELS: Record<TransferDirection, string> = {
  send: '汇款出去（人民币 → 外币）',
  receive: '汇回国内（外币 → 人民币）',
}

const LOCK_LABELS: Record<LockMode, string> = {
  sendAmount: '锁定汇出金额',
  receiveAmount: '锁定到账金额',
}

function App() {
  const [amountStr, setAmountStr] = useState('10000')
  const [fromCurrency, setFromCurrency] = useState('CNY')
  const [toCurrency, setToCurrency] = useState('USD')
  const [direction, setDirection] = useState<TransferDirection>('send')
  const [lockMode, setLockMode] = useState<LockMode>('sendAmount')
  const [banks, setBanks] = useState<Bank[]>(() =>
    structuredClone(DEFAULT_BANKS),
  )
  const [midRate, setMidRate] = useState<number | null>(null)
  const [results, setResults] = useState<
    { result: CalculationResult; fee: FeeBreakdown }[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showConfig, setShowConfig] = useState(false)

  const amount = Number(amountStr) || 0

  /** 手动查询汇率并计算 */
  const handleQuery = useCallback(async () => {
    if (!amountStr.trim() || amount <= 0) {
      setError('请输入有效金额')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const rate = await getMidRate(fromCurrency, toCurrency)
      if (rate === null) {
        setError('汇率获取失败，请检查网络后重试')
        setLoading(false)
        return
      }
      setMidRate(rate)

      const inputs = { amount, fromCurrency, toCurrency }
      const calcResults = calculateAll(banks, rate, inputs, direction, lockMode)
      setResults(calcResults)
    } catch {
      setError('计算出现错误，请重试')
    }
    setLoading(false)
  }, [amountStr, amount, fromCurrency, toCurrency, direction, lockMode, banks])

  const handleBankUpdate = (bankId: string, field: string, value: number | boolean | null) => {
    setBanks(prev =>
      prev.map(b => {
        if (b.id !== bankId) return b
        const newRates = { ...b.rates }
        for (const code of Object.keys(newRates)) {
          newRates[code] = { ...newRates[code], [field]: value }
        }
        return { ...b, rates: newRates }
      }),
    )
  }

  const handleDirectionChange = (d: TransferDirection) => {
    setDirection(d)
    if (d === 'send') {
      setFromCurrency('CNY')
      setToCurrency('USD')
    } else {
      setFromCurrency('USD')
      setToCurrency('CNY')
    }
  }

  const fmtMoney = (n: number, decimals = 2) => n.toLocaleString('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  const availableTargets = currencies.filter(c => c.code !== fromCurrency)

  const amountLabel = lockMode === 'sendAmount'
    ? `汇出金额（${getCurrencySymbol(fromCurrency)}）`
    : `目标到账金额（${getCurrencySymbol(toCurrency)}）`

  return (
    <div className="app">
      <header className="header">
        <h1>跨境汇兑计算器</h1>
        <p className="subtitle">对比各银行跨境汇款费用，帮你找到最划算的选择</p>
      </header>

      {/* ====== 输入区 ====== */}
      <section className="input-section">
        {/* 方向切换 */}
        <div className="direction-toggle">
          {(['send', 'receive'] as TransferDirection[]).map(d => (
            <button
              key={d}
              className={`toggle-btn ${d === direction ? 'active' : ''}`}
              onClick={() => handleDirectionChange(d)}
            >
              {DIRECTION_LABELS[d]}
            </button>
          ))}
        </div>

        {/* 锁定模式切换 */}
        <div className="lock-toggle">
          {(['sendAmount', 'receiveAmount'] as LockMode[]).map(m => (
            <button
              key={m}
              className={`toggle-btn toggle-sm ${m === lockMode ? 'active' : ''}`}
              onClick={() => setLockMode(m)}
            >
              {LOCK_LABELS[m]}
            </button>
          ))}
        </div>

        <div className="input-row">
          <div className="input-group">
            <label>{amountLabel}</label>
            <input
              type="number"
              value={amountStr}
              min={0}
              placeholder="输入金额"
              onChange={e => setAmountStr(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label>转出币种</label>
            <select
              value={fromCurrency}
              onChange={e => setFromCurrency(e.target.value)}
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>目标币种</label>
            <select
              value={toCurrency}
              onChange={e => setToCurrency(e.target.value)}
            >
              {availableTargets.map(c => (
                <option key={c.code} value={c.code}>
                  {c.symbol} {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {midRate !== null && (
          <div className="mid-rate-display">
            实时中间价：
            <strong>
              1 {getCurrencySymbol(fromCurrency)} = {fmtMoney(midRate, 6)}{' '}
              {getCurrencySymbol(toCurrency)}
            </strong>
          </div>
        )}
      </section>

      {/* ====== 查询按钮 ====== */}
      <div className="query-section">
        <button
          className="query-btn"
          onClick={handleQuery}
          disabled={loading}
        >
          {loading ? '正在查询...' : '查询各银行费用对比'}
        </button>
      </div>

      {/* ====== 加载 & 错误 ====== */}
      {loading && <div className="loading">正在获取实时汇率...</div>}
      {error && <div className="error">{error}</div>}

      {/* ====== 结果表格 ====== */}
      {results.length > 0 && (
        <section className="results-section">
          <h2>银行对比结果</h2>
          <p className="results-hint">
            {lockMode === 'sendAmount'
              ? '按到账金额从高到低排序（最划算的排最上面）'
              : '按需汇出金额从低到高排序（最划算的排最上面）'}
          </p>

          <div className="table-wrapper">
            <table className="result-table">
              <thead>
                <tr>
                  <th>银行</th>
                  <th>牌价类型</th>
                  <th>银行汇率</th>
                  <th>手续费</th>
                  <th>电报费</th>
                  <th>总成本（¥）</th>
                  {lockMode === 'sendAmount' ? (
                    <th className="amount-col">到账金额</th>
                  ) : (
                    <th className="amount-col">需汇出金额</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {results.map(({ result: r, fee }) => {
                  const isReceiveLock = lockMode === 'receiveAmount'
                  return (
                    <tr key={r.bankId} className={r.isBest ? 'best-row' : ''}>
                      <td className="bank-name">
                        {r.isBest && <span className="badge">推荐</span>}
                        {r.bankName}
                      </td>
                      <td>{fee.rateLabel}</td>
                      <td>{fmtMoney(r.bankRate, 6)}</td>
                      <td>{fee.feeMinMaxLabel}</td>
                      <td>{fmtMoney(fee.telegraphFeeCNY)}</td>
                      <td>{fmtMoney(fee.totalFeeCNY)}</td>
                      <td className="amount-col">
                        <strong>
                          {isReceiveLock
                            ? `${getCurrencySymbol(fromCurrency)}${fmtMoney(fee.requiredSendAmount ?? 0)}`
                            : `${getCurrencySymbol(toCurrency)}${fmtMoney(r.receivedAmount)}`}
                        </strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ====== 费率配置（可编辑） ====== */}
      <section className="config-section">
        <button
          className="config-toggle"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? '收起' : '展开'}银行费率配置
          <span className="config-hint">（点击修改各银行的实际费率）</span>
        </button>

        {showConfig && (
          <div className="config-grid">
            {banks.map(bank => {
              const rate = bank.rates[toCurrency]
              const sellRate = rate?.sellRate
              const buyRate = rate?.buyRate
              return (
                <div key={bank.id} className="bank-config-card">
                  <h3>{bank.name}</h3>

                  {midRate != null && (
                    <div className="rate-info">
                      市场中间价：<strong>{fmtMoney(midRate, 6)}</strong>
                    </div>
                  )}

                  <label>
                    卖出价（1{getCurrencySymbol(toCurrency)}=?元）💰
                    <span className="rate-hint">银行卖外币给你</span>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder={midRate ? String(1 / midRate) : ''}
                      value={sellRate ?? ''}
                      onChange={e =>
                        handleBankUpdate(bank.id, 'sellRate', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </label>
                  <label>
                    买入价（1{getCurrencySymbol(toCurrency)}=?元）💴
                    <span className="rate-hint">银行买你的外币</span>
                    <input
                      type="number"
                      step="0.0001"
                      placeholder={midRate ? String(midRate) : ''}
                      value={buyRate ?? ''}
                      onChange={e =>
                        handleBankUpdate(bank.id, 'buyRate', e.target.value ? Number(e.target.value) : null)
                      }
                    />
                  </label>
                  <label>
                    手续费比例（%）
                    <input
                      type="number"
                      step="0.05"
                      value={((rate?.feePercent ?? 0) * 100).toFixed(2)}
                      onChange={e =>
                        handleBankUpdate(bank.id, 'feePercent', Number(e.target.value) / 100)
                      }
                    />
                  </label>
                  <div className="config-row">
                    <label>
                      最低（¥）
                      <input
                        type="number"
                        value={rate?.feeMinCNY ?? 0}
                        onChange={e =>
                          handleBankUpdate(bank.id, 'feeMinCNY', Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      最高（¥）
                      <input
                        type="number"
                        value={rate?.feeMaxCNY ?? 0}
                        onChange={e =>
                          handleBankUpdate(bank.id, 'feeMaxCNY', Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <label>
                    电报费（元）
                    <input
                      type="number"
                      step="10"
                      value={rate?.telegraphFeeCNY ?? 0}
                      onChange={e =>
                        handleBankUpdate(bank.id, 'telegraphFeeCNY', Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rate?.deductFromForeign ?? false}
                      onChange={e =>
                        handleBankUpdate(bank.id, 'deductFromForeign', e.target.checked)
                      }
                    />
                    费用以汇款币种收取（农行模式）
                  </label>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <footer className="footer">
        <p>
          汇率数据来源于{' '}
          <a href="https://open.er-api.com" target="_blank">
            Open Exchange Rate API
          </a>
          ，银行费率为预设典型值，仅供参考。实际费率请以各银行公布为准。
        </p>
      </footer>
    </div>
  )
}

export default App