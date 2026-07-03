import {
  CategoryScale, // X 軸分類刻度，例如 1月、2月。
  Chart,// Chart 是建立圖表 instance 的主類別。
  Legend,// Legend 是圖例，例如 2024 / 2025 / 2026。
  LinearScale,// Y 軸數值刻度。
  LineController, // 折線圖控制器。
  LineElement, // 折線本身。
  PointElement,  // 折線上的資料點。
  Title,// 圖表標題模組，目前主要註冊備用。
  Tooltip, // 小提示框。
} from 'chart.js'

// Chart.js v3+ 需要先註冊會用到的模組，否則圖表無法渲染。
// Chart.js 需要先註冊用到的圖表元件，折線圖才能正常顯示。
Chart.register(
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
)

// 將濃度數值格式化成小數點後兩位；不合法的值顯示 -。

// 將濃度數值格式化成小數點兩位，tooltip 和匯出圖表會用到。
export const formatConcentration = (value) => {
  // 嘗試把 value 轉成數字。
  const numericValue = Number(value)
  // 合法數字才 toFixed；不合法就回傳 -。
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : '-'
}

// 將月份標籤縮短，避免 X 軸文字太長造成擁擠。
export const compactMonthLabel = (label) => String(label || '').replace('年', '/').replace('月', '')

// 建立專案共用的折線圖設定。
// 產生共用折線圖設定，年度對比與月份查詢都使用這份配置。
export const createLineChartOptions = ({ showLegend = true } = {}) => ({
  responsive: true,// responsive 讓圖表跟著容器尺寸變化。
  maintainAspectRatio: false,// false 代表高度由 CSS 的 .chart-box 控制。
  layout: {
    padding: { top: 8, right: 18, bottom: 4, left: 6 },
  },
  // 圖表重畫時的動畫設定。
  animation: {
    // 動畫時間 450ms。
    duration: 450,
    // 動畫曲線。
    easing: 'easeOutQuart',
  },
  // 滑鼠互動設定。
  interaction: {
    // false 代表滑鼠不用精準碰到點，也能顯示 tooltip。
    intersect: false,
    // index 代表同一個 X 軸位置的多條線一起顯示。
    mode: 'index',
  },
  // plugins 控制圖例與 tooltip。
  plugins: {
    // showLegend true 顯示圖例；false 隱藏圖例。
    legend: showLegend
      ? {
          // 圖例放在圖表上方。
          position: 'top',
          align: 'center',
          // 圖例標籤樣式。
          labels: {
            // 用點狀圖例，比預設方塊更接近折線圖。
            usePointStyle: true,
            // 圖例點的寬度。
            boxWidth: 8,
            boxHeight: 8,
            color: '#334155',
            padding: 18,
          },
        }
      // 自訂查詢只有一條線，所以可以關閉圖例。
      : { display: false },
    // tooltip 是滑鼠移到圖表時出現的浮動資訊。
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 13, weight: '600' },
      bodyFont: { size: 13 },
      // callbacks 可以自訂 tooltip 顯示文字。
      callbacks: {
        // 每一行 tooltip 顯示：資料集名稱 + 濃度 + 單位。 
        label: (context) => `${context.dataset.label}: ${formatConcentration(context.parsed.y)} μg/m³`,
      },
    },
  },
  // scales 設定 X 軸與 Y 軸。
  scales: {
    // X 軸不顯示格線，畫面比較乾淨。
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: {
        color: '#64748b',
        maxRotation: 0,
        minRotation: 0,
        autoSkip: true,
        maxTicksLimit: 36,
        callback(value) {
          return compactMonthLabel(this.getLabelForValue(value))
        },
      },
    },
    // Y 軸是濃度數值。
    y: {
      // 從 0 開始，方便比較濃度高低。
      beginAtZero: true,
      border: { display: false },
      grid: {
        color: '#e8edf5',
        drawTicks: false,
      },
      ticks: {
        color: '#64748b',
        padding: 8,
      },
      // Y 軸標題。
      title: {
        // 顯示 Y 軸標題。
        display: true,
        // Y 軸文字。
        text: '濃度 (μg/m³)',
        color: '#475569',
        font: { size: 13, weight: '500' },
      },
    },
  },
})

// 把註冊好的 Chart 匯出給 Vue 元件建立圖表。
// 匯出 Chart 建構子，讓各元件可以建立或銷毀自己的圖表實例。
export { Chart }
