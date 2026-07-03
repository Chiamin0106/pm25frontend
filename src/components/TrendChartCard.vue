<template>
  <a-card class="primary-chart-card">
    <template #title>PM2.5 濃度年度對比</template>
    <template #extra>
      <a-space>
        <a-tag v-if="saveStatus.message" class="save-status-tag" :color="saveStatus.type === 'success' ? 'success' : 'error'">
          {{ saveStatus.message }}
        </a-tag>
        <a-tag v-if="isTrendLoading" color="processing">圖表更新中</a-tag>
        <a-typography-text v-else type="secondary">
          {{ selectedStation ? `目前測站：${selectedStation}` : '請先選擇測站' }}
        </a-typography-text>
      </a-space>
    </template>

    <a-form layout="vertical">
      <a-row class="query-row" :gutter="[12, 12]">
        <a-col :xs="24" :md="10">
          <a-form-item label="選擇測站">
            <a-select
              :value="selectedStation"
              show-search
              :loading="isStationsLoading"
              :disabled="isStationsLoading || stations.length === 0"
              placeholder="請選擇測站"
              :filter-option="filterSelectOption"
              @update:value="$emit('update:selectedStation', $event)"
            >
              <a-select-option v-for="station in stations" :key="station" :value="station">
                {{ station }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="4">
          <a-form-item label="年份 1">
            <a-select
              v-model:value="selectedYearOne"
              :loading="isYearsLoading"
              :disabled="isYearsLoading || availableYears.length === 0"
              placeholder="選擇年份"
            >
              <a-select-option
                v-for="year in availableYears"
                :key="year"
                :value="year"
                :disabled="year === selectedYearTwo"
              >
                {{ year }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="4">
          <a-form-item label="年份 2">
            <a-select
              v-model:value="selectedYearTwo"
              :loading="isYearsLoading"
              :disabled="isYearsLoading || availableYears.length === 0"
              placeholder="選擇年份"
            >
              <a-select-option
                v-for="year in availableYears"
                :key="year"
                :value="year"
                :disabled="year === selectedYearOne"
              >
                {{ year }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="6" class="query-action-col">
          <a-form-item label="操作">
            <a-button
              type="primary"
              block
              :loading="isTrendLoading || isChartSaving"
              :disabled="!selectedStation || selectedYears.length === 0"
              @click="queryAndSaveTrend"
            >
              <template #icon><SearchOutlined /></template>
              查詢並儲存
            </a-button>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <div class="chart-box">
      <canvas ref="trendCanvasRef" aria-label="各年度 PM2.5 月均濃度折線圖"></canvas>
      <a-empty v-if="!selectedStation" class="chart-empty" description="選擇測站後按查詢顯示趨勢圖" />
    </div>
  </a-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { getTrendAnalysis } from '../api/airQualityApi'
import { DEFAULT_MONTH_LABELS } from '../api/normalizers'
import { Chart, createLineChartOptions } from '../utils/chart'
import { filterSelectOption } from '../utils/select'

const props = defineProps({
  // app.vue傳入的
  stations: { type: Array, default: () => [] },
  availableYears: { type: Array, default: () => [] },
  selectedStation: { type: String, default: '' },
  isStationsLoading: { type: Boolean, default: false },
  isYearsLoading: { type: Boolean, default: false },
  isChartSaving: { type: Boolean, default: false },
  saveStatus: {
    type: Object,
    default: () => ({ type: 'success', message: '' }),
  },
})

// update:selectedStation 對應 v-model；snapshot-change 回傳目前圖表資料；query-save 通知父層儲存圖表。
const emit = defineEmits(['update:selectedStation', 'snapshot-change', 'query-save'])

// 不同年份使用固定顏色，讓年度對比圖比較容易辨識。
const DATASET_COLORS = {
  2023: '#722ed1',
  2024: '#1677ff',
  2025: '#fa8c16',
  2026: '#52c41a',
}
const FALLBACK_COLORS = ['#eb2f96', '#13c2c2', '#a0d911', '#faad14', '#2f54eb']

// canvas ref 用來交給 Chart.js 建立折線圖。
const trendCanvasRef = ref(null)
const trendLabels = ref(DEFAULT_MONTH_LABELS)
const trendDatasets = ref([])
const selectedYearOne = ref(null)
const selectedYearTwo = ref(null)
const isTrendLoading = ref(false)
let trendChart = null
let trendRequestId = 0
let trendLoadTimer = null

const selectedYears = computed(() =>
  // 使用者最多選兩個年份，這裡過濾空值並排序。
  [selectedYearOne.value, selectedYearTwo.value]
    .filter((year) => year !== null && year !== undefined)
    .sort((a, b) => a - b)
)

const chartData = computed(() => ({
  // Chart.js 需要 labels + datasets 的資料格式。
  labels: trendLabels.value,
  datasets: trendDatasets.value,
}))

const buildChartDataset = ({ label, year, data }, index = 0) => {
  // 將後端回傳的 dataset 加上 Chart.js 所需的線條樣式。
  const color = DATASET_COLORS[year] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length]

  return {
    label: label || `${year} PM2.5 平均濃度`,
    year,
    data,
    borderColor: color,
    backgroundColor: `${color}22`,
    pointBackgroundColor: '#ffffff',
    pointBorderColor: color,
    pointBorderWidth: 2,
    pointRadius: 3,
    pointHoverRadius: 6,
    borderWidth: 3,
    tension: 0.35,
    spanGaps: true,
  }
}

const chartOptions = createLineChartOptions()

const applyDefaultYears = (years = []) => {
  // 預設優先選 2024、2025；如果沒有，就選資料中最新兩年。
  const cleanYears = [...new Set(years)].sort((a, b) => a - b)

  if (cleanYears.length === 0) {
    selectedYearOne.value = null
    selectedYearTwo.value = null
    return
  }

  const defaultYears = cleanYears.includes(2024) && cleanYears.includes(2025)
    ? [2024, 2025]
    : cleanYears.slice(-2)
  selectedYearOne.value = defaultYears[0] ?? null
  selectedYearTwo.value = defaultYears[1] ?? null
}

const destroyTrendChart = () => {
  // 切換資料或離開元件前先銷毀舊圖表，避免 canvas 重複綁定。
  if (trendChart) {
    trendChart.destroy()
    trendChart = null
  }
}

const renderTrendChart = async () => {
  // 等 Vue 把 DOM 更新完，再建立 Chart.js 圖表。
  await nextTick()
  destroyTrendChart()

  if (!trendCanvasRef.value || !props.selectedStation) return

  trendChart = new Chart(trendCanvasRef.value, {
    type: 'line',
    data: chartData.value,
    options: chartOptions,
  })
}

const loadTrend = async ({ saveAfterLoad = false } = {}) => {
  // 沒有測站或年份時不查詢，避免送出無效 API。
  if (!props.selectedStation || selectedYears.value.length === 0) return

  // requestId 用來避免較慢的舊請求覆蓋較新的查詢結果。
  const requestId = ++trendRequestId
  isTrendLoading.value = true

  try {
    const trend = await getTrendAnalysis(props.selectedStation, selectedYears.value)
    if (requestId !== trendRequestId) return

    // 只保留目前選中的年份資料，避免後端回傳範圍內其他年份影響圖表。
    const selectedYearSet = new Set(selectedYears.value)
    //只保留目前選中的年份
    const selectedDatasets = trend.datasets.filter((dataset) => selectedYearSet.has(dataset.year))

    trendLabels.value = trend.labels
    trendDatasets.value = selectedDatasets.map(buildChartDataset)

    const snapshot = {
      // snapshot 是儲存圖表紀錄時要放進 charts collection 的快照。
      labels: trendLabels.value,
      datasets: trendDatasets.value.map(({ label, year, data }) => ({ label, year, data })),
      years: [...selectedYears.value],
    }

    emit('snapshot-change', snapshot)
    await renderTrendChart()

    if (saveAfterLoad) {
      emit('query-save', { snapshot, years: [...selectedYears.value] })
    }
  } catch (error) {
    if (requestId !== trendRequestId) return
    destroyTrendChart()
    message.error(error.message || '趨勢資料載入失敗。')
  } finally {
    if (requestId === trendRequestId) isTrendLoading.value = false
  }
}

const queryAndSaveTrend = () => {
  // 按下查詢並儲存時，先重新查資料，成功後再 emit query-save。
  loadTrend({ saveAfterLoad: true })
}

const scheduleTrendLoad = () => {
  // 使用 setTimeout 合併短時間內的多次變化，避免重複打 API。消尚未執行的舊查詢
  if (trendLoadTimer) clearTimeout(trendLoadTimer)
  trendLoadTimer = setTimeout(() => {
    trendLoadTimer = null
    loadTrend()
  }, 0)
}

watch(
  () => props.availableYears,
  (years) => {
    // 父層年份清單改變時，重新套用預設年份並查詢。
    applyDefaultYears(years)
    scheduleTrendLoad()
  },
  { immediate: true },
)

watch(
  selectedYears,
  () => {
    // 使用者切換年份時自動刷新年度對比圖。
    scheduleTrendLoad()
  },
  { deep: true },
)

defineExpose({ loadTrend })

onBeforeUnmount(() => {
  // 元件卸載前清掉 timer 與 Chart 實例，避免記憶體殘留。
  if (trendLoadTimer) clearTimeout(trendLoadTimer)
  destroyTrendChart()
})
</script>
