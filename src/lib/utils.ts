import { Timestamp } from 'firebase/firestore'

/** NT$ 格式化 */
export function currency(amount: number): string {
  return `NT$ ${Math.round(amount).toLocaleString()}`
}

/** 帶正負號 NT$ */
export function signedCurrency(amount: number): string {
  const sign = amount >= 0 ? '+' : ''
  return `${sign}NT$ ${Math.round(amount).toLocaleString()}`
}

/** Firestore Timestamp → Date */
export function toDate(ts: Timestamp | Date | undefined): Date {
  if (!ts) return new Date()
  if (ts instanceof Date) return ts
  return ts.toDate()
}

/** 日期格式化 MM/DD */
export function fmtDate(d: Date): string {
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

/** 日期格式化 YYYY/MM/DD（E） */
export function fmtDateFull(d: Date): string {
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, '0')
  const dd = d.getDate().toString().padStart(2, '0')
  return `${y}/${m}/${dd}（${days[d.getDay()]}）`
}

/** 付款方式標籤 */
export function paymentLabel(method: string): string {
  return { cash: '現金', creditCard: '信用卡', transfer: '轉帳' }[method] ?? method
}
