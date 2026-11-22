import React from 'react'

export default function LogoB3({ width = 110, height = 64, className = '' }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 130 76"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Navy Left 'B' */}
      <path
        d="M20 18H38C44.5 18 48.5 21 48.5 25.5C48.5 29 45.8 32 41 33C47 34 50 37.5 50 43C50 48.5 45 52 38 52H20V18Z"
        fill="#0d284f"
      />
      <path
        d="M27 24H37C40 24 41.8 25.2 41.8 27.2C41.8 29.2 40 30.5 37 30.5H27V24ZM27 36.5H37.5C40.8 36.5 42.8 37.8 42.8 40.2C42.8 42.6 40.8 44 37.5 44H27V36.5Z"
        fill="#ffffff"
      />

      {/* Invoice Document in Center */}
      <rect
        x="43"
        y="12"
        width="34"
        height="44"
        rx="3"
        fill="#ffffff"
        stroke="#0d284f"
        strokeWidth="2.5"
      />
      {/* Invoice Text Lines */}
      <line x1="48" y1="20" x2="68" y2="20" stroke="#0d284f" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="48" y1="26" x2="68" y2="26" stroke="#0d284f" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="48" y1="32" x2="60" y2="32" stroke="#0d284f" strokeWidth="2.2" strokeLinecap="round" />

      {/* Checkmark in Invoice */}
      <path
        d="M52 40L57 44.5L67 33"
        stroke="#00a884"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Teal Right 'B' / '3' */}
      <path
        d="M74 18H92C98.5 18 102.5 21 102.5 25.5C102.5 29 99.8 32 95 33C101 34 104 37.5 104 43C104 48.5 99 52 92 52H74V18Z"
        fill="#00a884"
      />
      <path
        d="M81 24H91C94 24 95.8 25.2 95.8 27.2C95.8 29.2 94 30.5 91 30.5H81V24ZM81 36.5H91.5C94.8 36.5 96.8 37.8 96.8 40.2C96.8 42.6 94.8 44 91.5 44H81V36.5Z"
        fill="#ffffff"
      />

      {/* Bottom Gear Icon */}
      <g transform="translate(44, 49) scale(0.65)">
        <rect x="5" y="5" width="14" height="14" rx="2" fill="#00a884" />
        <circle cx="12" cy="12" r="3.5" fill="#ffffff" />
        <rect x="10.5" y="2" width="3" height="4" fill="#00a884" rx="1" />
        <rect x="10.5" y="18" width="3" height="4" fill="#00a884" rx="1" />
        <rect x="2" y="10.5" width="4" height="3" fill="#00a884" rx="1" />
        <rect x="18" y="10.5" width="4" height="3" fill="#00a884" rx="1" />
      </g>

      {/* Bottom Sync / Reload Arrows */}
      <path
        d="M62 60C64.5 57.5 68 56.5 71.5 57.2C75 58 77.5 60.5 78.5 63.8C79.5 67 78.5 70.5 75.8 72.8C73 75 69 75.5 65.5 74.2"
        stroke="#00a884"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M66 56L61 60L65 64"
        stroke="#00a884"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 76L76 72L79 75"
        stroke="#00a884"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
