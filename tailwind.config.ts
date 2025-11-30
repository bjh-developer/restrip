import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/ui/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			'blush-pink': {
  				DEFAULT: '#FFC9D1',
  				hover: '#FFB3BD'
  			},
  			'soft-black': '#1C1C1C',
  			'warm-beige': '#F3E8D8',
  			grey: '#6B6B6B',
  			'pastel-blue': '#CFE7FF',
  			'mist-grey': '#EBEBEB',
            'yellow-cream': '#FFF2C9',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		fontFamily: {
  			display: [
  				'var(--font-display)',
  				'serif'
  			],
  			body: [
  				'var(--font-body)',
  				'sans-serif'
  			]
  		},
  		borderRadius: {
  			xs: '4px',
  			sm: 'calc(var(--radius) - 4px)',
  			md: 'calc(var(--radius) - 2px)',
  			lg: 'var(--radius)',
  			xl: '24px'
  		},
  		boxShadow: {
  			card: '0 2px 8px rgba(0, 0, 0, 0.08)',
  			'card-hover': '0 4px 12px rgba(0, 0, 0, 0.12)'
  		},
  		minHeight: {
  			button: '48px'
  		},
  		keyframes: {
  			shine: {
  				'0%': { 'background-position': '200% 0' },
  				'100%': { 'background-position': '-200% 0' },
  			},
  		},
  		animation: {
  			shine: 'shine 5s linear infinite',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
