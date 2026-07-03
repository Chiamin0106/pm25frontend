import { apiRequest } from './http'
import { normalizeChart, normalizeCharts } from './normalizers'

// 取得 charts collection 裡的所有圖表紀錄。
// 讀取 charts collection 的所有圖表紀錄，顯示在「查詢圖表紀錄」區塊。
export const getCharts = async () => normalizeCharts(await apiRequest('/api/charts'))

// 新增一筆圖表紀錄。
// 新增一筆圖表紀錄，body 會包含查詢條件與當下圖表快照。
export const createChart = (body) =>
  apiRequest('/api/charts', {
    method: 'POST',
    data: body,
  }).then(normalizeChart)

// 依照 MongoDB _id 刪除一筆圖表紀錄。
// 依照 MongoDB _id 刪除指定圖表紀錄。
export const deleteChartById = (id) =>
  apiRequest(`/api/charts/${id}`, {
    method: 'DELETE',
  })
