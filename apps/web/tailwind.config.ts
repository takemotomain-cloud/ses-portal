import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS 設定
 *
 * 引き継ぎドキュメントのデザインルール（カラー・フォント・spacing）を
 * Tailwindのカスタムテーマとして定義。
 * HTMLプロトタイプのCSS変数と1:1で対応させる。
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      // デザインルール準拠のカラーパレット
      colors: {
        page: '#F7F7F5',
        card: '#FFFFFF',
        accent: {
          DEFAULT: '#FFF1AB',
          text: '#5C4D00',
        },
        primary: '#1A1A1A',
        secondary: '#6B6B6B',
        border: {
          DEFAULT: '#E5E5E3',
          light: '#F0F0EE',
        },
        // 状態色（1対1ルール）
        status: {
          green: { bg: '#E6F6ED', text: '#1B7D40' },
          red: { bg: '#FDEAEA', text: '#A32D2D' },
          amber: { bg: '#FFF3E0', text: '#8B5E00' },
          blue: { bg: '#E8F0FE', text: '#1A56B8' },
        },
      },
      // デザインルール準拠のフォントファミリー
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Hiragino Sans',
          'Hiragino Kaku Gothic ProN',
          'Meiryo',
          'sans-serif',
        ],
      },
      // letter-spacing: 0.03em 固定
      letterSpacing: {
        base: '0.03em',
      },
      // レイアウト定数
      spacing: {
        'header': '56px',
        'bottom-nav': '64px',
        'sidebar': '220px',
      },
      maxWidth: {
        'content': '640px',
      },
      fontSize: {
        // UIモックの各所で使うサイズ
        '2xs': ['10px', { lineHeight: '1.4' }],
        'xs': ['11px', { lineHeight: '1.5' }],
        'sm': ['12px', { lineHeight: '1.6' }],
        'base': ['13px', { lineHeight: '1.6' }],
        'md': ['14px', { lineHeight: '1.7' }],
        'lg': ['15px', { lineHeight: '1.7' }],
        'xl': ['16px', { lineHeight: '1.7' }],
        '2xl': ['18px', { lineHeight: '1.6' }],
        '3xl': ['20px', { lineHeight: '1.5' }],
        '4xl': ['22px', { lineHeight: '1.4' }],
        'clock': ['40px', { lineHeight: '1.2' }],
      },
    },
  },
  plugins: [],
};

export default config;
