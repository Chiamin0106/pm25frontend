
// 年度對比圖固定使用 1 到 12 月做 X 軸。
export const DEFAULT_MONTH_LABELS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`)

// 後端目前只保留月份查詢。
const GROUP_BY_VALUES = ['month']

// 把後端回傳值轉成乾淨字串，避免 null、undefined 直接顯示在畫面。
const toCleanString = (value, fallback = '') => {
  // 沒有值時，直接回傳預設文字。
  if (value === null || value === undefined) return fallback
  // 有值時轉字串並去掉前後空白。
  return String(value).trim()
}

// 把任何值轉成有限數字；失敗時回傳 fallback。
// 把後端回傳值轉成有限數字；轉失敗就使用 fallback。
const toFiniteNumber = (value, fallback) => {
  // Number 可以把 '2024' 這種字串轉成 2024。
  const number = Number(value)
  // Number.isFinite 避免 NaN、Infinity 進入畫面。
  return Number.isFinite(number) ? number : fallback
}

// 把圖表數值轉成 number；空值或壞資料保留成 null，Chart.js 會斷點不畫。
// 圖表數值可以是 number 或 null；null 代表該月份沒有資料。
const toNullableNumber = (value) => {
  // 後端如果沒有某月份資料，可能會是 null/undefined/空字串。
  if (value === null || value === undefined || value === '') return null
  // 嘗試轉成數字。
  const number = Number(value)
  // 成功就回傳數字，失敗就回傳 null。
  return Number.isFinite(number) ? number : null
}

// 清洗一整條圖表資料陣列，例如 12 個月份濃度。
// 整理圖表資料陣列，確保每一格都是 number 或 null。
const normalizeNumberSeries = (values, length = 12) => {
  // 如果後端沒有給陣列，就用空陣列當來源。
  const source = Array.isArray(values) ? values : []
  // 產生固定長度陣列，逐格轉成 number 或 null。
  return Array.from({ length }, (_, index) => toNullableNumber(source[index]))
}

// 清洗 /api/stations 回傳資料。
// 整理 /api/stations 回傳結果，給測站下拉選單使用。
export const normalizeStations = (payload) => {
  // 正常後端應該回傳陣列；不是陣列就回空陣列。
  if (!Array.isArray(payload)) return []

  // 每個測站轉字串、去空白，
  return payload
    .map((station) => toCleanString(station))
//再移除空值。
    .filter(Boolean)
}

// 清洗 /api/analysis/trend 回傳的年度趨勢資料。
// 整理 /api/years 回傳結果，確保年份是由小到大排序的數字。
export const normalizeYears = (payload) => {
  if (!Array.isArray(payload)) return []

  return payload
    .map((year) => toFiniteNumber(year, null))
    .filter((year) => year !== null)
    .sort((a, b) => a - b)
}

// 整理年度對比 API 回傳結果，確保 labels、datasets 結構符合 Chart.js。
export const normalizeTrendAnalysis = (payload) => {
  // 清洗 datasets，每一筆代表一個年份的 12 個月資料。
  const datasets = Array.isArray(payload?.datasets)
    ? payload.datasets
        .map((dataset) => ({
          // 線圖名稱，例如 2024 PM2.5 平均濃度。
          label: toCleanString(dataset?.label),
          year: toFiniteNumber(dataset?.year, null),
          data: normalizeNumberSeries(dataset?.data),
        }))
        // 沒有合法年份的線不畫。
        .filter((dataset) => dataset.year !== null)
    : []

  // 回傳給 TrendChartCard 的固定格式。
  return {
    // 目前測站名稱。
    sitename: toCleanString(payload?.sitename),
    // X 軸月份標籤；若後端缺資料，用預設 1月~12月。
    labels: Array.isArray(payload?.labels)
      ? DEFAULT_MONTH_LABELS.map((fallback, index) => toCleanString(payload.labels[index], fallback))
      : DEFAULT_MONTH_LABELS,
    // 清洗後的年度線圖資料。
    datasets,
    // 原始聚合資料，儲存圖表快照時可以保留。
    rawData: Array.isArray(payload?.rawData) ? payload.rawData : [],
  }
}

// 清洗 /api/analysis/custom 回傳的自訂分析資料。
// 整理月份動態查詢 API 回傳結果，給 CustomAnalysisCard 畫單線趨勢圖。
export const normalizeCustomAnalysis = (payload) => {
  // 自訂分析 X 軸長度不固定，不同年份範圍會有不同月份數量。
  const labels = Array.isArray(payload?.labels)
  //[" 2024年1月 ", null, "2024年3月"]=>["2024年1月", "2024年3月"]
    ? payload.labels.map((label) => toCleanString(label)).filter(Boolean)
    : []

  // 回傳給 CustomAnalysisCard 的固定格式。
  return {
    // 沒有指定測站時顯示全部測站。
    sitename: toCleanString(payload?.sitename, '全部測站'),
    // 預設污染物是 PM2.5。
    itemengname: toCleanString(payload?.itemengname, 'PM2.5'),
    // groupBy 固定為 month。
    groupBy: 'month',
    // 起始年不合法時回到 2024。
    startYear: toFiniteNumber(payload?.startYear, 2024),
    // 起始月不合法時回到 1。
    startMonth: toFiniteNumber(payload?.startMonth, 1),
    // 結束年不合法時回到 2026。
    endYear: toFiniteNumber(payload?.endYear, 2026),
    // 結束月不合法時回到 12。
    endMonth: toFiniteNumber(payload?.endMonth, 12),
    // X 軸標籤。
    labels,
    // Y 軸資料長度跟 labels 一樣。
    data: normalizeNumberSeries(payload?.data, labels.length),
    // 後端詳細 rows，儲存圖表快照時使用。
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
  }
}

// 清洗單筆 charts collection 圖表紀錄。
// 整理單筆圖表紀錄，避免缺少欄位時造成前端顯示錯誤。
export const normalizeChart = (chart = {}) => {
  // normalized 是真正顯示和儲存會用到的乾淨資料。
  const normalized = {
    // 保留後端其他欄位，例如 createdAt、updatedAt。
    ...chart,
    // MongoDB _id 轉成字串。
    _id: toCleanString(chart._id),
    // 沒有名稱時給預設文字。
    chartName: toCleanString(chart.chartName, '未命名圖表'),
    // 沒有類型時預設 trend。
    chartType: toCleanString(chart.chartType, 'trend'),
    // 測站可能為空，空字串代表全部測站或未指定。
    selectedStation: toCleanString(chart.selectedStation),
    // 污染物預設 PM2.5。
    itemengname: toCleanString(chart.itemengname, 'PM2.5'),
    // 粒度固定為 month。
    groupBy: GROUP_BY_VALUES.includes(chart.groupBy) ? chart.groupBy : 'month',
    // 起始年轉成數字。
    startYear: toFiniteNumber(chart.startYear, 2024),
    // 起始月轉成數字。
    startMonth: toFiniteNumber(chart.startMonth, 1),
    // 結束年轉成數字。
    endYear: toFiniteNumber(chart.endYear, 2026),
    // 結束月轉成數字。
    endMonth: toFiniteNumber(chart.endMonth, 12),
    // query 必須是物件，不是物件就改成空物件。
    query: chart.query && typeof chart.query === 'object' ? chart.query : {},
    // resultSnapshot 必須是物件，否則不保留。
    resultSnapshot:
      chart.resultSnapshot && typeof chart.resultSnapshot === 'object' ? chart.resultSnapshot : null,
  }

  return normalized
}

// 清洗圖表紀錄陣列。
// 整理圖表紀錄清單，只保留有 _id 的合法資料。
export const normalizeCharts = (payload) => {
  // 後端正常會回傳陣列；不是陣列就給空陣列。
  if (!Array.isArray(payload)) return []
  // 每筆紀錄清洗後，只保留有 _id 的資料。
  return payload.map(normalizeChart).filter((chart) => chart._id)
}

// 清洗新增 2026 資料後，後端回傳的單筆 sensor data。
// 整理新增資料成功後的回傳值。
export const normalizeCreatedSensorData = (payload = {}) => ({
  // 先保留後端原本回傳的所有欄位。
  ...payload,
  // 測站名稱轉成乾淨字串。
  sitename: toCleanString(payload.sitename),
  // 污染物預設 PM2.5。
  itemengname: toCleanString(payload.itemengname, 'PM2.5'),
  // 月份轉成數字。
  monitormonth: toFiniteNumber(payload.monitormonth, 202601),
  // 濃度轉成數字。
  concentration: toFiniteNumber(payload.concentration, 0),
})

// 整理單筆測站資料，給資料維護表格使用。
export const normalizeSensorDataRow = (payload = {}) => ({
  ...payload,
  _id: toCleanString(payload._id),
  sitename: toCleanString(payload.sitename),
  itemengname: toCleanString(payload.itemengname, 'PM2.5'),
  monitormonth: toFiniteNumber(payload.monitormonth, 202601),
  concentration: toFiniteNumber(payload.concentration, 0),
})

// 整理測站資料清單，只保留有 _id 的合法資料列。
export const normalizeSensorDataRows = (payload) => {
  if (!Array.isArray(payload)) return []
  return payload.map(normalizeSensorDataRow).filter((row) => row._id)
}
