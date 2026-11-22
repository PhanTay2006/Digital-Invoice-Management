import React, { useRef } from 'react'
import { formatCurrencyInput } from '../../utils/format'

/**
 * Ô nhập liệu tiền tệ chuẩn Việt Nam (tự động phân cách hàng nghìn bằng dấu chấm, VD: 100.000)
 */
export default function CurrencyInput({
  value,
  onChange,
  placeholder = 'VD: 100.000',
  required = false,
  disabled = false,
  className = '',
  style = {},
  name,
  id,
  min,
  ...rest
}) {
  const inputRef = useRef(null)
  const displayValue = formatCurrencyInput(value)

  const handleChange = (e) => {
    const input = e.target
    const cursor = input.selectionStart || 0
    const rawInputVal = input.value

    // Đếm số lượng chữ số nằm phía trước con trỏ hiện tại
    const digitsBeforeCursor = rawInputVal.slice(0, cursor).replace(/\D/g, '').length

    // Lọc ra chuỗi chỉ chứa số
    const cleanDigits = rawInputVal.replace(/\D/g, '')

    // Gọi onChange với giá trị số (hoặc rỗng nếu người dùng xóa hết)
    const numericValue = cleanDigits === '' ? '' : Number(cleanDigits)
    if (onChange) {
      onChange(numericValue)
    }

    // Khôi phục vị trí con trỏ sau khi React re-render
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (!el) return
      let newPos = 0
      let digitsSeen = 0
      for (let i = 0; i < el.value.length; i++) {
        if (/\d/.test(el.value[i])) {
          digitsSeen++
        }
        if (digitsSeen >= digitsBeforeCursor) {
          newPos = i + 1
          break
        }
      }
      if (digitsBeforeCursor === 0) newPos = 0
      el.setSelectionRange(newPos, newPos)
    })
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className={className}
      style={style}
      name={name}
      id={id}
      autoComplete="off"
      {...rest}
    />
  )
}
