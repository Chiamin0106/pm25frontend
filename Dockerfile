# 第一階段：使用 Node.js 環境進行打包
FROM node:20-alpine AS build-stage

# 設定工作目錄
WORKDIR /app

# 先複製 package.json 和 lock 檔案，利用 Docker 快取機制加速
COPY package*.json ./

# 使用 npm ci 進行乾淨安裝，確保版本與您的開發環境完全一致
RUN npm ci

# 複製所有原始碼
COPY . .

# 執行 build，如果還是失敗，請檢查下方註解的常見原因
RUN npm run build

# 第二階段：使用 Nginx 輕量級網頁伺服器
FROM nginx:alpine

# 將打包好的 dist 複製到 Nginx 的網頁目錄
COPY --from=build-stage /app/dist /usr/share/nginx/html

# 開放 80 port
EXPOSE 80

# 啟動 Nginx
CMD ["nginx", "-g", "daemon off;"]