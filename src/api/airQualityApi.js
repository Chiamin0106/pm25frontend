import { apiRequest } from './http'
// 匯入資料清洗函式，讓 Vue 元件拿到的資料格式固定。
import {
  normalizeCreatedSensorData,
  normalizeCustomAnalysis,
  normalizeSensorDataRow,
  normalizeSensorDataRows,
  normalizeStations,
  normalizeTrendAnalysis,
  normalizeYears,
} from './normalizers'

// 取得測站清單
// 取得測站下拉選單資料：後端會從 air_quality 找出不重複 sitename。
export const getStations = async () => normalizeStations(await apiRequest('/api/stations'))

// 取得指定測站可查詢的年份，年度對比下拉選單會使用。
export const getAvailableYears = async (sitename) => {
  const params = new URLSearchParams()
  if (sitename) params.set('sitename', sitename)

  const queryString = params.toString()
  return normalizeYears(await apiRequest(`/api/years${queryString ? `?${queryString}` : ''}`))
}

// 取得指定測站的年度月均趨勢資料。
// 呼叫年度對比 API：回傳 labels + datasets，前端可直接畫多年份折線圖。
export const getTrendAnalysis = (sitename, years = []) => {
  const params = new URLSearchParams({ sitename })
  if (years.length > 0) params.set('years', years.join(','))

  // URL: /api/analysis/trend?sitename=%E5%9F%BA%E9%9A%86&years=2024%2C2025。
  return apiRequest(`/api/analysis/trend?${params.toString()}`).then(normalizeTrendAnalysis)
}

// 取得月份自訂分析資料。
// 呼叫月份動態查詢 API：回傳 labels + data + rows，前端可畫指定區間折線圖。
export const getCustomAnalysis = (query) => {
  // URLSearchParams 用來安全組合 query string。
  const params = new URLSearchParams({
    // 起始年轉成字串，符合 URL query 格式。
    startYear: String(query.startYear),
    // 起始月轉成字串，符合 URL query 格式。
    startMonth: String(query.startMonth),
    // 結束年轉成字串，符合 URL query 格式。
    endYear: String(query.endYear),
    // 結束月轉成字串，符合 URL query 格式。
    endMonth: String(query.endMonth),
  })

  // 有指定測站才加入 sitename；空字串代表查全部測站。
  if (query.sitename) params.set('sitename', query.sitename)

  // 呼叫自訂分析 API，回傳前統一清洗格式。
  return apiRequest(`/api/analysis/custom?${params.toString()}`).then(normalizeCustomAnalysis)
}

// 新增單筆 2026 空氣品質資料。
// 新增一筆 PM2.5 測站月資料，對應後端 POST /api/sensor-data。
export const createSensorData = (body) =>
  // POST /api/sensor-data，body 需要轉成 JSON 字串。
  apiRequest('/api/sensor-data', {
    method: 'POST',
    data: body,
  // 新增成功後，也把後端回傳資料清洗成固定格式。
  }).then(normalizeCreatedSensorData)

// 讀取 2026 空氣品質資料；有 sitename 時只讀指定測站。
// 查詢測站資料維護表格，通常依測站與年份範圍取得資料。
export const getSensorData = (query = {}) => {
  const params = new URLSearchParams()
  if (query.sitename) params.set('sitename', query.sitename)
  if (query.startYear) params.set('startYear', String(query.startYear))
  if (query.startMonth) params.set('startMonth', String(query.startMonth))
  if (query.endYear) params.set('endYear', String(query.endYear))
  if (query.endMonth) params.set('endMonth', String(query.endMonth))

  const queryString = params.toString()
  return apiRequest(`/api/sensor-data${queryString ? `?${queryString}` : ''}`).then(normalizeSensorDataRows)
}

// 更新一筆 PM2.5 月資料，id 是 MongoDB 的 _id。
export const updateSensorData = (id, body) =>
  apiRequest(`/api/sensor-data/${id}`, {
    method: 'PUT',
    data: body,
  }).then(normalizeSensorDataRow)

// 刪除單筆 2026 空氣品質資料。
// 刪除一筆 PM2.5 月資料，刪除後 App.vue 會刷新圖表與表格。
export const deleteSensorData = (id) =>
  apiRequest(`/api/sensor-data/${id}`, {
    method: 'DELETE',
  })
