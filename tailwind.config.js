/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        habitat: {
          green: '#0099CC',
          'green-dark': '#007AA3',
          'green-light': '#33ADDB',
          orange: '#F7941D',
          blue: '#0072BC',
        }
      }
    },
  },
  plugins: [],
}
