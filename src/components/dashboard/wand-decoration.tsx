export function WandDecoration() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-4 -top-6 hidden h-[300px] w-[390px] select-none lg:block"
    >
      <svg
        viewBox="0 0 400 300"
        fill="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <filter id="neonGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <linearGradient
            id="trailGrad"
            x1="60"
            y1="260"
            x2="350"
            y2="50"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1be67a" stopOpacity="0" />
            <stop offset="50%" stopColor="#1be67a" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7dffba" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        <path
          d="M50 55 C 140 20, 290 25, 345 95 C 390 155, 330 220, 140 275"
          stroke="url(#trailGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          opacity="0.35"
          filter="url(#softGlow)"
        />
        <path
          d="M70 255 C 210 255, 375 185, 360 110 C 345 45, 220 35, 110 55"
          stroke="#1be67a"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
          filter="url(#neonGlow)"
        />
        <path
          d="M180 280 C 295 250, 385 180, 340 120"
          stroke="#47ff9c"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.4"
          filter="url(#neonGlow)"
        />

        <circle
          cx="248"
          cy="70"
          r="24"
          fill="#1be67a"
          opacity="0.45"
          filter="url(#softGlow)"
        />

        <g transform="translate(245, 65) rotate(-42)">
          <rect
            x="-8"
            y="0"
            width="16"
            height="122"
            rx="8"
            fill="#08130f"
            stroke="#22f587"
            strokeWidth="1.8"
            filter="url(#neonGlow)"
          />
          <rect
            x="-8"
            y="0"
            width="16"
            height="32"
            rx="6"
            fill="#d9ffea"
            filter="url(#neonGlow)"
          />
          <rect x="-7" y="1" width="14" height="30" rx="5" fill="#8effc1" />
        </g>

        <path
          d="M312 32 L316 44 L328 48 L316 52 L312 64 L308 52 L296 48 L308 44 Z"
          fill="#1be67a"
          opacity="0.85"
          filter="url(#neonGlow)"
        />
        <path
          d="M352 55 L354.5 62.5 L362 65 L354.5 67.5 L352 75 L349.5 67.5 L342 65 L349.5 62.5 Z"
          fill="#4dff9f"
          opacity="0.9"
          filter="url(#neonGlow)"
        />
        <circle cx="290" cy="82" r="2" fill="#8cffc2" />
        <circle cx="268" cy="120" r="1.5" fill="#1be67a" />
        <circle cx="325" cy="105" r="2.2" fill="#4dff9f" />
        <circle cx="235" cy="95" r="1.8" fill="#a7ffd0" />
      </svg>
    </div>
  );
}
