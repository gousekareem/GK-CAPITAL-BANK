/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // GK Capital Bank brand colors
        sbi: { 50:'#eff6ff', 100:'#dbeafe', 600:'#1a5276', 700:'#154360', 800:'#0d2d44', gold:'#d4ac0d' },
        gkc: { 50:'#eff6ff', 100:'#dbeafe', 600:'#1a5276', 700:'#154360', 800:'#0d2d44', gold:'#d4ac0d' }
      }
    }
  },
  plugins: [],
}
