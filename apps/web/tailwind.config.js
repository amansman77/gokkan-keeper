/** @type {import('tailwindcss').Config} */

// Design tokens live as CSS variables in src/index.css so a single definition
// drives both themes; these names expose them as utility classes.
// See docs/DESIGN_SYSTEM.md.
const token = (name) => `var(--gk-${name})`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: {
          DEFAULT: token('surface'),
          2: token('surface-2'),
        },
        line: {
          DEFAULT: token('border'),
          soft: token('border-soft'),
        },
        ink: {
          DEFAULT: token('ink'),
          muted: token('ink-muted'),
          faint: token('ink-faint'),
        },
        accent: {
          DEFAULT: token('accent'),
          tint: token('accent-tint'),
          ink: token('accent-ink'),
          contrast: token('accent-contrast'),
        },
        // Directional (Korean market convention: rise = red, fall = blue).
        gain: {
          DEFAULT: token('gain'),
          tint: token('gain-tint'),
        },
        loss: {
          DEFAULT: token('loss'),
          tint: token('loss-tint'),
        },
        // Status. Kept separate from the directional pair so that flipping the
        // market convention never turns an error message blue.
        danger: {
          DEFAULT: token('danger'),
          tint: token('danger-tint'),
        },
        success: {
          DEFAULT: token('success'),
          tint: token('success-tint'),
        },
        flow: {
          DEFAULT: token('flow'),
          tint: token('flow-tint'),
        },
        closed: token('closed-tint'),
        inverse: {
          DEFAULT: token('inverse'),
          ink: token('inverse-ink'),
        },
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'sans-serif',
        ],
      },
      fontWeight: {
        // The variable font allows mid-weights a static family cannot provide;
        // 380 is the Judgment Diary body weight.
        prose: '380',
        lead: '450',
      },
    },
  },
  plugins: [],
}
