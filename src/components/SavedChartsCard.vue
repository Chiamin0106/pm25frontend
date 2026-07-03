<template>
  <a-card class="secondary-card saved-charts-card">
    <template #title>查詢圖表紀錄</template>
    <template #extra>
      <a-button type="primary" :disabled="charts.length === 0" @click="exportAllAsPdf">
        <template #icon><FilePdfOutlined /></template>
        匯出所有圖表
      </a-button>
    </template>

    <a-empty v-if="charts.length === 0" description="目前尚未儲存任何查詢紀錄" />
    <a-row v-else :gutter="[16, 16]">
      <a-col v-for="chart in charts" :key="chart._id" :xs="24" :lg="12">
        <a-card size="small" class="record-card">
          <div class="record-header">
            <a-typography-title :level="5" class="record-title">{{ chart.chartName }}</a-typography-title>
            <a-popconfirm title="確定刪除這筆查詢紀錄？" ok-text="刪除" cancel-text="取消" @confirm="$emit('delete', chart._id)">
              <a-button danger size="small" class="record-delete-button">
                <template #icon><DeleteOutlined /></template>
                刪除
              </a-button>
            </a-popconfirm>
          </div>

          <a-space wrap class="record-meta">
            <a-tag :color="chart.chartType === 'trend' ? 'blue' : 'cyan'">{{ chart.chartType }}</a-tag>
            <a-tag>{{ chart.selectedStation || '全部測站' }}</a-tag>
            <a-tag>{{ chart.itemengname }}</a-tag>
          </a-space>

          <a-descriptions class="record-details" size="small" :column="1">
            <a-descriptions-item label="期間">
              {{ chart.startYear }}/{{ chart.startMonth }} - {{ chart.endYear }}/{{ chart.endMonth }}
            </a-descriptions-item>
            <a-descriptions-item label="資料點">
              {{ getSnapshotCount(chart) }} 筆
            </a-descriptions-item>
          </a-descriptions>

          <a-typography-text type="secondary" class="record-created">
            建立時間：{{ formatDate(chart.createdAt) }}
          </a-typography-text>
        </a-card>
      </a-col>
    </a-row>
  </a-card>
</template>

<script setup>
import { message } from 'ant-design-vue'
import { DeleteOutlined, FilePdfOutlined } from '@ant-design/icons-vue'
import { compactMonthLabel } from '../utils/chart'

const props = defineProps({
  // charts 由 App.vue 透過 GET /api/charts 載入後傳入。
  charts: { type: Array, default: () => [] },
})

// delete 事件交給 App.vue 呼叫後端刪除，這個元件只負責顯示與發出事件。
defineEmits(['delete'])

// 匯出圖片時，各資料線使用固定顏色。
const CHART_COLORS = ['#1677ff', '#fa8c16', '#52c41a', '#722ed1']

const formatDate = (value) => {
  // 將 MongoDB 儲存的 ISO 日期轉成台灣本地時間字串。
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-TW')
}


const getChartSeries = (chart) => {
  // trend 圖使用 datasets；custom 圖使用 data，這裡統一轉成 series 陣列。
  const snapshot = chart.resultSnapshot || {}

  if (Array.isArray(snapshot.datasets)) {
    return snapshot.datasets.map((dataset) => ({
      label: dataset.label,
      data: dataset.data || [],
    }))
  }

  return [
    {
      label: chart.chartName,
      data: snapshot.data || [],
    },
  ]
}

const getSnapshotCount = (chart) => {
  // 計算快照中有多少資料點，顯示在卡片資訊上。
  const snapshot = chart.resultSnapshot || {}
  if (Array.isArray(snapshot.datasets)) {
    return snapshot.datasets.reduce((total, dataset) => total + (dataset.data?.length || 0), 0)
  }

  return snapshot.data?.length || 0
}

const createChartCanvas = (chart) => {
  // 使用原生 canvas 重畫圖表，目的是匯出成圖片後放進 PDF 列印頁。
  const labels = chart.resultSnapshot?.labels || []
  const series = getChartSeries(chart)
  const width = Math.max(1200, labels.length * 72 + 176)
  const height = 720
  const padding = { top: 122, right: 84, bottom: 112, left: 92 }
  const canvas = document.createElement('canvas')
  // 產生離畫面的 canvas，不影響目前頁面上的圖表。
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, width, height)

  context.fillStyle = '#ffffff'
  context.strokeStyle = '#e5edf7'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(32, 28, width - 64, height - 56, 18)
  context.fill()
  context.stroke()

  context.fillStyle = '#0f172a'
  context.font = 'bold 32px Microsoft JhengHei, Arial'
  context.fillText(chart.chartName, padding.left, 66)

  const rangeText = `${chart.startYear}/${chart.startMonth || 1} - ${chart.endYear}/${chart.endMonth || 12}`
  context.fillStyle = '#64748b'
  context.font = '18px Microsoft JhengHei, Arial'
  context.fillText(`${chart.selectedStation || '全部測站'} / ${chart.itemengname} / ${rangeText}`, padding.left, 98)

  const values = series.flatMap((item) => item.data).filter((value) => Number.isFinite(Number(value))).map(Number)
  // 依照資料最大值自動調整 Y 軸上限。
  const rawMaxValue = Math.max(...values, 10)
  const maxValue = Math.ceil(rawMaxValue / 5) * 5
  const minValue = 0
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  for (let step = 0; step <= 5; step += 1) {
    // 繪製 Y 軸水平格線與刻度文字。
    const ratio = step / 5
    const y = padding.top + plotHeight - plotHeight * ratio
    const value = minValue + (maxValue - minValue) * ratio

    context.strokeStyle = step === 0 ? '#cbd5e1' : '#e8edf5'
    context.lineWidth = step === 0 ? 1.5 : 1
    context.beginPath()
    context.moveTo(padding.left, y)
    context.lineTo(padding.left + plotWidth, y)
    context.stroke()

    context.fillStyle = '#64748b'
    context.font = '14px Arial'
    context.textAlign = 'right'
    context.fillText(value.toFixed(0), padding.left - 16, y + 5)
  }

  series.forEach((item, seriesIndex) => {
    // 每個 series 代表一條折線，例如 2024 或 2025。
    const color = CHART_COLORS[seriesIndex % CHART_COLORS.length]
    const points = item.data
      .map((rawValue, index) => {
        const value = Number(rawValue)
        if (!Number.isFinite(value)) return null

        return {
          x: padding.left + (labels.length <= 1 ? 0 : (plotWidth * index) / (labels.length - 1)),
          y: padding.top + plotHeight - ((value - minValue) / (maxValue - minValue || 1)) * plotHeight,
        }
      })
      .filter(Boolean)

    if (points.length === 0) return

    context.strokeStyle = color
    context.lineWidth = 4
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.beginPath()

    points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y)
        return
      }

      const previous = points[index - 1]
      const midX = (previous.x + point.x) / 2
      const midY = (previous.y + point.y) / 2
      context.quadraticCurveTo(previous.x, previous.y, midX, midY)
      context.quadraticCurveTo(point.x, point.y, point.x, point.y)
    })

    context.stroke()

    points.forEach((point) => {
      // 每個資料點畫成白底圓點，和主圖表視覺一致。
      context.fillStyle = '#ffffff'
      context.strokeStyle = color
      context.lineWidth = 3
      context.beginPath()
      context.arc(point.x, point.y, 5, 0, Math.PI * 2)
      context.fill()
      context.stroke()
    })

    const legendX = padding.left + seriesIndex * 280
    const legendY = height - 48
    context.fillStyle = color
    context.beginPath()
    context.arc(legendX, legendY - 5, 6, 0, Math.PI * 2)
    context.fill()
    context.fillStyle = '#334155'
    context.font = '16px Microsoft JhengHei, Arial'
    context.textAlign = 'left'
    context.fillText(item.label || `資料 ${seriesIndex + 1}`, legendX + 14, legendY)
  })

  context.fillStyle = '#64748b'
  context.font = '14px Microsoft JhengHei, Arial'
  context.textAlign = 'center'
  labels.forEach((label, index) => {
    // X 軸標籤旋轉，避免月份文字互相重疊。
    const x = padding.left + (labels.length <= 1 ? 0 : (plotWidth * index) / (labels.length - 1))
    context.save()
    context.translate(x, height - 86)
    context.rotate(-Math.PI / 7)
    context.fillText(compactMonthLabel(label), 0, 0)
    context.restore()
  })

  context.save()
  context.translate(48, padding.top + plotHeight / 2)
  context.rotate(-Math.PI / 2)
  context.fillStyle = '#475569'
  context.font = '15px Microsoft JhengHei, Arial'
  context.textAlign = 'center'
  context.fillText('濃度 (μg/m³)', 0, 0)
  context.restore()

  return canvas
}

const exportAllAsPdf = () => {
  // 開新視窗放入所有圖表圖片，再呼叫瀏覽器列印功能輸出 PDF。
  const printableWindow = window.open('', '_blank')

  if (!printableWindow) {
    message.error('瀏覽器阻擋了 PDF 匯出視窗，請允許彈出視窗後再試一次。')
    return
  }

  const images = props.charts.map((chart) => ({
    // 將每筆圖表紀錄轉成 PNG data URL。
    title: chart.chartName,
    src: createChartCanvas(chart).toDataURL('image/png'),
  }))

  printableWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>查詢圖表紀錄</title>
        <style>
          body { margin: 0; font-family: "Microsoft JhengHei", Arial, sans-serif; }
          section { page-break-after: always; padding: 20px; background: #f8fafc; }
          img { width: 100%; max-width: 1080px; display: block; margin: 0 auto; }
        </style>
      </head>
      <body>
        ${images.map((image) => `<section><img alt="${image.title}" src="${image.src}" /></section>`).join('')}
        <script>
          const waitForImages = () => Promise.all(
            Array.from(document.images).map((image) => {
              if (image.decode) return image.decode().catch(() => {});
              if (image.complete) return Promise.resolve();
              return new Promise((resolve) => {
                image.onload = resolve;
                image.onerror = resolve;
              });
            })
          );

          window.addEventListener('load', () => {
            waitForImages().then(() => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 500);
            });
          });
        </scr${'ipt'}>
      </body>
    </html>
  `)
  printableWindow.document.close()
}
</script>
