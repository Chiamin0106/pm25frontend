<template>
  <!-- Ant Design Vue 全域設定； -->
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#1677ff',
        borderRadius: 8,
        fontFamily: 'Microsoft JhengHei, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
        controlHeight: 36,
      },
      components: {
        Card: {
          headerBg: '#ffffff',
        },
      },
    }"
  >
    <!--  整個頁面的版面框架。 -->
    <a-layout class="app-shell">
      <!--  是主要內容區。 -->
      <a-layout-content class="app-content">
        <!--  讓每個大區塊上下保持固定間距。 -->
        <a-space direction="vertical" size="large" class="full-width">
          <!-- 只顯示頁面標題與成功/錯誤訊息。 -->
          <DashboardHeader
            :message-text="messageText"
            :error-message="errorMessage"
          />

          <!-- 主趨勢圖區：selectedStation 改變時自動查詢；snapshot-change 把目前圖表資料交回 App.vue。 -->
          <TrendChartCard
            ref="trendChartRef"
            v-model:selected-station="selectedStation"
            :stations="stations"
            :available-years="availableYears"
            :is-stations-loading="isStationsLoading"
            :is-years-loading="isYearsLoading"
            :is-chart-saving="isChartSaving"
            :save-status="chartSaveStatus.target === 'trend' ? chartSaveStatus : emptySaveStatus"
            @snapshot-change="trendSnapshot = $event"
            @query-save="saveTrendChart"
          />

          <!-- 月份查詢區：查詢完成後透過 save-custom 交給共用 saveChart 儲存。 -->
          <CustomAnalysisCard
            ref="customAnalysisRef"
            :stations="stations"
            :initial-station="selectedStation"
            :is-chart-saving="isChartSaving"
            :save-status="chartSaveStatus.target === 'custom' ? chartSaveStatus : emptySaveStatus"
            @save-custom="(body) => saveChart(body, 'custom')"
          />

          <!-- 手動維護 2026 資料區：新增、更新、刪除成功後刷新圖表。 -->
          <SensorDataForm
            :stations="stations"
            :available-years="availableYears"
            :initial-station="selectedStation"
            @changed="handleSensorChanged"
          />

          <!-- 查詢圖表紀錄區：顯示、刪除、匯出圖片與匯出 PDF。 -->
          <SavedChartsCard
            :charts="charts"
            @delete="deleteChart"
          />
        </a-space>
      </a-layout-content>
    </a-layout>
  </a-config-provider>
</template>

<script setup>


// onMounted 是元件載入後執行；ref 即時更新頁面 ；watch 監聽資料變化。
import { onMounted, ref, watch } from 'vue'
//  message.success(text) 
import { message } from 'ant-design-vue'

import { getAvailableYears, getStations } from './api/airQualityApi'
import { createChart, deleteChartById, getCharts } from './api/chartApi'
// 自訂分析元件。
import CustomAnalysisCard from './components/CustomAnalysisCard.vue'
// 頂部控制區元件。
import DashboardHeader from './components/DashboardHeader.vue'
// 查詢圖表紀錄元件。
import SavedChartsCard from './components/SavedChartsCard.vue'
// 新增 2026 資料表單元件。
import SensorDataForm from './components/SensorDataForm.vue'
// 主趨勢圖元件。
import TrendChartCard from './components/TrendChartCard.vue'

const stations = ref([])
const selectedStation = ref('')
const availableYears = ref([])
const charts = ref([])
const trendSnapshot = ref({ labels: [], datasets: [] })

// loading 狀態會傳給子元件，用來控制按鈕、下拉選單和儲存中的提示。
const isStationsLoading = ref(false)
const isYearsLoading = ref(false)
const isChartSaving = ref(false)

// 頁面上方的成功/錯誤訊息。
const messageText = ref('')
const errorMessage = ref('')
let messageTimer = null

// 圖表儲存狀態會依照 target 分給年度對比或月份查詢，避免兩邊同時顯示。
const emptySaveStatus = { target: '', type: 'success', message: '' }
const chartSaveStatus = ref(emptySaveStatus)
let chartSaveStatusTimer = null

// 子元件 ref：父元件需要主動呼叫子元件。
const trendChartRef = ref(null)
const customAnalysisRef = ref(null)

// 顯示成功訊息，同步更新 Ant Design Vue message 與卡片內 alert。
const setMessage = (text) => {
  if (messageTimer) clearTimeout(messageTimer)

  messageText.value = text// Card 成功使用。
  errorMessage.value = ''
  message.success(text)  // 右上方彈出成功提示。

  messageTimer = setTimeout(() => {
    messageText.value = ''
    messageTimer = null
  }, 3000)
}

// 顯示錯誤訊息，同步更新 Ant Design Vue message 與卡片內 alert。
const setError = (text) => {
  if (messageTimer) {
    clearTimeout(messageTimer)
    messageTimer = null
  }

  errorMessage.value = text  // 卡片內錯誤 alert 使用。
  messageText.value = ''  
  message.error(text)  // 右上方彈出錯誤提示。
}

const setChartSaveStatus = (target, type, messageTextValue) => {
  // target 可能是 trend 或 custom，用來指定哪張卡片顯示儲存狀態。
  chartSaveStatus.value = { target, type, message: messageTextValue }
  if (chartSaveStatusTimer) clearTimeout(chartSaveStatusTimer)
  chartSaveStatusTimer = setTimeout(() => {
    chartSaveStatus.value = emptySaveStatus
  }, 4000)
}

// 載入測站清單。
const loadStations = async () => {

  isStationsLoading.value = true

  try {
    // API 層會回傳清洗後的測站陣列。
    stations.value = await getStations()
    //載入成功後`預設選第一個測站。
    if (!selectedStation.value && stations.value.length > 0) {
      selectedStation.value = stations.value[0]
    }
  } catch (error) {
    setError(error.message || '測站清單載入失敗。')
  } finally {
    isStationsLoading.value = false
  }
}

// 載入查詢圖表紀錄。
const loadCharts = async () => {
  try {
    // API 層會回傳清洗後的圖表紀錄。
    charts.value = await getCharts()
  } catch (error) {
    setError(error.message || '圖表紀錄載入失敗。')
  }
}

const loadAvailableYears = async (sitename = selectedStation.value) => {
  // 沒有測站時清空年份，避免子元件使用舊資料。
  if (!sitename) {
    availableYears.value = []
    return
  }

  isYearsLoading.value = true

  try {
    availableYears.value = await getAvailableYears(sitename)
  } catch (error) {
    availableYears.value = []
    setError(error.message || '年份資料載入失敗。')
  } finally {
    isYearsLoading.value = false
  }
}

// 共用儲存圖表函式。趨勢圖和自訂查詢都會呼叫這個函式。
const saveChart = async (body, target = 'custom') => {
  // 開啟儲存 loading，避免重複送出。
  isChartSaving.value = true

  try {
    // 呼叫 POST /api/charts  後端新增。 
    await createChart(body)
    // 前端同步
    await loadCharts()
    setChartSaveStatus(target, 'success', '圖表紀錄已儲存。')
  } catch (error) {
    // 儲存失敗時顯示錯誤。
    setChartSaveStatus(target, 'error', error.message || '圖表紀錄儲存失敗。')
  } finally {
    isChartSaving.value = false
  }
}

// 儲存目前主趨勢圖。
const saveTrendChart = async ({ snapshot = trendSnapshot.value, years = trendSnapshot.value.years || availableYears.value.slice(-2) } = {}) => {
  // 年度對比圖可能選 1 到 2 個年份，儲存前先排序，確保起訖年份正確。
  const sortedYears = [...years].sort((a, b) => a - b)

  await saveChart({
    chartName: `${selectedStation.value} PM2.5 濃度年度對比`,
    chartType: 'trend',
    selectedStation: selectedStation.value,
    itemengname: 'PM2.5',
    groupBy: 'month',
    startYear: sortedYears[0],
    endYear: sortedYears[sortedYears.length - 1],
    // 保存查詢條件。
    query: { sitename: selectedStation.value, years: sortedYears.join(',') },
    // 當下的截圖。
    resultSnapshot: snapshot,
  }, 'trend')
}

// 刪除查詢圖表紀錄。
const deleteChart = async (id) => {
  try {
    await deleteChartById(id)
    await loadCharts()
    setMessage('圖表紀錄已刪除。')
  } catch (error) {
    // 刪除失敗時顯示錯誤。
    setError(error.message || '圖表紀錄刪除失敗。')
  }
}

// 2026 資料新增、更新、刪除成功後，刷新受影響的圖表。
const handleSensorChanged = async ({ sitename }) => {
  // 如果異動資料的測站就是目前主圖測站，刷新主趨勢圖。
  if (selectedStation.value === sitename) {
    await loadAvailableYears(sitename)
    //父呼叫子更新 vlaue有值才會動作 null就不動作
    await trendChartRef.value?.loadTrend()
  }
  // 父呼叫子更新 vlaue有值才會動作 null就不動作
  await customAnalysisRef.value?.loadCustomAnalysis()
}

watch(selectedStation, (station) => {
  // 使用者切換主測站時，同步刷新該測站可用年份。
  loadAvailableYears(station)
})

// onmouted 第一次載入時，先取得測站與圖表紀錄，再觸發自訂查詢。
onMounted(async () => {
  // 測站清單與圖表紀錄可以同時載入。
  await Promise.all([loadStations(), loadCharts()])
  // 子元件建立後，主動載入一次自訂分析。
  await customAnalysisRef.value?.loadCustomAnalysis()
})

</script>
