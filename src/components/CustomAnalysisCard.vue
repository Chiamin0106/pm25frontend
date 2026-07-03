<template>
  <a-card class="secondary-card custom-analysis-card">
    <template #title>月份動態查詢</template>
    <template #extra>
      <a-tag v-if="saveStatus.message" class="save-status-tag" :color="saveStatus.type === 'success' ? 'success' : 'error'">
        {{ saveStatus.message }}
      </a-tag>
    </template>

    <a-form layout="vertical">
      <a-row class="query-row" :gutter="[16, 8]">
        <a-col :xs="24" :md="12" :lg="10">
          <a-form-item label="測站">
            <a-select
              v-model:value="customQuery.sitename"
              show-search
              allow-clear
              placeholder="全部測站"
              :filter-option="filterSelectOption"
            >
              <a-select-option value="">全部測站</a-select-option>
              <a-select-option v-for="station in stations" :key="station" :value="station">
                {{ station }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="6" :lg="5">
          <a-form-item label="起始年月">
            <a-select v-model:value="startPeriod" class="full-width" :options="periodOptions" />
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="6" :lg="5">
          <a-form-item label="結束年月">
            <a-select v-model:value="endPeriod" class="full-width" :options="periodOptions" />
          </a-form-item>
        </a-col>

        <a-col :xs="24" :lg="4" class="query-action-col">
          <a-form-item label="操作">
            <a-button type="primary" block :loading="isCustomLoading || isChartSaving" @click="queryAndSaveCustom">
              <template #icon><SearchOutlined /></template>
              查詢並儲存
            </a-button>
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <div class="custom-chart-scroll">
      <div class="chart-box custom-chart" :style="{ width: customChartWidth }">
        <canvas ref="customCanvasRef" aria-label="月份分析圖表"></canvas>
      </div>
    </div>
  </a-card>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { SearchOutlined } from '@ant-design/icons-vue'
import { getCustomAnalysis } from '../api/airQualityApi'
import { Chart, createLineChartOptions } from '../utils/chart'
import { filterSelectOption } from '../utils/select'

const props = defineProps({
  // stations 給測站下拉選單；initialStation 讓月份查詢預設跟主圖測站一致。
  stations: { type: Array, default: () => [] },
  initialStation: { type: String, default: '' },
  isChartSaving: { type: Boolean, default: false },
  saveStatus: {
    type: Object,
    default: () => ({ type: 'success', message: '' }),
  },
})

// save-custom 會把查詢條件與圖表快照交給 App.vue 儲存。
const emit = defineEmits(['save-custom'])

// 月份查詢條件，最後會轉成 /api/analysis/custom 的 query string。
const customQuery = reactive({
  sitename: '',
  startYear: 2023,
  startMonth: 1,
  endYear: 2026,
  endMonth: 12,
})

const customLabels = ref([])
const customRows = ref([])
const customData = ref([])
// startPeriod / endPeriod 使用 YYYYMM 數字，方便下拉選單處理。
const startPeriod = ref(202301)
const endPeriod = ref(202612)
const isCustomLoading = ref(false)
const customCanvasRef = ref(null)
let customChart = null
let autoRefreshTimer = null

const customChartTitle = computed(() => `${customQuery.sitename || '全部測站'} PM2.5 月平均`)
const customChartWidth = computed(() => `${Math.max(1000, customLabels.value.length * 72)}px`)
const chartOptions = createLineChartOptions({ showLegend: false })
// 產生 2023/1 到 2026/12 的年月選項。
const periodOptions = Array.from({ length: 48 }, (_, index) => {
  const year = 2023 + Math.floor(index / 12)
  const month = (index % 12) + 1

  return {
    label: `${year}年${month}月`,
    value: year * 100 + month,
  }
})

const applyPeriodToQuery = () => {
  // 把 YYYYMM 拆回 startYear/startMonth/endYear/endMonth，符合後端 API 參數。
  customQuery.startYear = Math.floor(startPeriod.value / 100)
  customQuery.startMonth = startPeriod.value % 100
  customQuery.endYear = Math.floor(endPeriod.value / 100)
  customQuery.endMonth = endPeriod.value % 100
}

const destroyCustomChart = () => {
  // 重新繪圖前先銷毀舊圖，避免 Chart.js 重複使用同一個 canvas。
  if (customChart) {
    customChart.destroy()
    customChart = null
  }
}

const renderCustomChart = async () => {
  // 等 Vue 更新 canvas 後，再建立 Chart.js 折線圖。
  await nextTick()
  destroyCustomChart()

  if (!customCanvasRef.value || customLabels.value.length === 0) return

  customChart = new Chart(customCanvasRef.value, {
    type: 'line',
    data: {
      labels: customLabels.value,
      datasets: [
        {
          label: customChartTitle.value,
          data: customData.value,
          borderColor: '#1677ff',
          backgroundColor: 'rgba(22, 119, 255, 0.12)',
          pointBackgroundColor: '#ffffff',
          pointBorderColor: '#1677ff',
          pointBorderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 3,
          tension: 0.38,
          spanGaps: true,
        },
      ],
    },
    options: chartOptions,
  })
}

const loadCustomAnalysis = async ({ saveAfterLoad = false } = {}) => {
  // 載入中狀態會讓查詢按鈕顯示 loading。
  isCustomLoading.value = true

  try {
    applyPeriodToQuery()
    // 呼叫後端 aggregation API，取得指定區間的月平均濃度。
    const payload = await getCustomAnalysis(customQuery)
    customLabels.value = payload.labels
    customData.value = payload.data
    customRows.value = payload.rows

    await renderCustomChart()

    const resultSnapshot = {
      // 保存目前圖表資料，讓查詢圖表紀錄可以匯出或回看。
      labels: customLabels.value,
      data: customData.value,
      rows: customRows.value,
    }

    if (saveAfterLoad) {
      // 只有使用者按下「查詢並儲存」時才 emit 給父層新增 charts 紀錄。
      emit('save-custom', {
        chartName: customChartTitle.value,
        chartType: 'custom',
        selectedStation: customQuery.sitename,
        itemengname: 'PM2.5',
        groupBy: 'month',
        startYear: customQuery.startYear,
        startMonth: customQuery.startMonth,
        endYear: customQuery.endYear,
        endMonth: customQuery.endMonth,
        query: { ...customQuery, itemengname: 'PM2.5', groupBy: 'month' },
        resultSnapshot,
      })
    }

  } catch (error) {
    destroyCustomChart()
    message.error(error.message || '月份查詢失敗。')
  } finally {
    isCustomLoading.value = false
  }
}

const queryAndSaveCustom = () => {
  // 按鈕行為：重新查詢資料，成功後儲存圖表紀錄。
  loadCustomAnalysis({ saveAfterLoad: true })
}

const scheduleAutoRefresh = () => {
  // 使用者調整測站或年月後稍微延遲查詢，避免連續變更時重複打 API。
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer)
  autoRefreshTimer = setTimeout(() => {
    loadCustomAnalysis()
  }, 200)
}

watch(
  () => props.initialStation,
  (station) => {
    // 第一次進頁面時，若月份查詢尚未選測站，就套用主圖的測站。
    if (!customQuery.sitename && station) customQuery.sitename = station
  },
  { immediate: true },
)

watch(
  [() => customQuery.sitename, startPeriod, endPeriod],
  () => {
    // 查詢條件改變時自動刷新月份分析圖。
    scheduleAutoRefresh()
  },
)

defineExpose({ loadCustomAnalysis })

onBeforeUnmount(() => {
  // 元件卸載前清掉 timer 與 Chart 實例。
  if (autoRefreshTimer) clearTimeout(autoRefreshTimer)
  destroyCustomChart()
})
</script>
