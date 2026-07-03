import axios from 'axios'

// 建立共用 axios 實例，所有前端 API 都會從這裡送到 Express 後端。
const api = axios.create({
  // 後端 server.js 監聽在 localhost:3000。
  baseURL: 'http://localhost:3000',
  // 告訴後端這次傳送與接收的資料格式是 JSON。
  headers: {
    'Content-Type': 'application/json',
  },
})

// 統一的 API 請求函式：成功時只回傳 response.data，失敗時轉成 Error。
export const apiRequest = async (path, config = {}) => {
  try {
    // path 是 API 路徑，例如 /api/stations；config 可放 method、data 等設定。
    const response = await api({
      url: path,
      ...config,
    })

    // 後端真正回傳的 JSON 會放在 response.data。
    return response.data
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message || 'API 請求失敗')
  }
}
