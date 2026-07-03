<template>
  <a-card class="secondary-card sensor-data-card">
    <template #title>測站數據管理</template>

    <a-form layout="vertical">
      <a-row :gutter="[16, 8]">
        <a-col :xs="24" :md="12" :lg="6">
          <a-form-item label="測站">
            <a-select
              v-model:value="sensorForm.sitename"
              show-search
              placeholder="選擇測站"
              :filter-option="filterSelectOption"
            >
              <a-select-option v-for="station in stations" :key="station" :value="station">
                {{ station }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="12" :lg="6">
          <a-form-item label="年份">
            <a-select v-model:value="sensorForm.year">
              <a-select-option v-for="year in yearOptions" :key="year" :value="year">
                {{ year }} 年
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="12" :lg="6">
          <a-form-item label="月份">
            <a-select v-model:value="sensorForm.month">
              <a-select-option v-for="month in monthOptions" :key="month" :value="month">
                {{ month }} 月
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :xs="24" :md="12" :lg="6">
          <a-form-item label="濃度">
            <a-input-number
              v-model:value="sensorForm.concentration"
              :min="0"
              :step="0.01"
              class="full-width"
              placeholder="例如 12.5"
            />
          </a-form-item>
        </a-col>
      </a-row>
    </a-form>

    <a-space wrap>
      <a-button type="primary" ghost :loading="isSensorSaving" @click="submitSensorData">
        <template #icon>
          <SaveOutlined v-if="editingId" />
          <PlusOutlined v-else />
        </template>
        {{ editingId ? '更新資料' : '新增資料' }}
      </a-button>

      <a-button v-if="editingId" @click="cancelEdit">
        <template #icon><CloseOutlined /></template>
        取消編輯
      </a-button>
    </a-space>

    <a-divider />

    <div class="section-heading">
      <a-typography-title :level="5">已建立的空氣品質資料</a-typography-title>
      <a-typography-text type="secondary">
        目前列表：{{ sensorForm.sitename || '未選擇測站' }} / {{ sensorForm.year }} 年
      </a-typography-text>
    </div>

    <a-typography-text v-if="editingId" class="edit-hint" type="secondary">
      正在編輯：{{ sensorForm.sitename }} {{ formatMonth(monitormonth) }}
    </a-typography-text>

    <a-table
      bordered
      :columns="columns"
      :data-source="sensorRows"
      :loading="isRowsLoading"
      :pagination="{ pageSize: 5 }"
      row-key="_id"
      size="small"
      :scroll="{ x: 720 }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'monitormonth'">
          {{ formatMonth(record.monitormonth) }}
        </template>

        <template v-else-if="column.key === 'concentration'">
          <a-tag color="geekblue">{{ record.concentration }} μg/m³</a-tag>
        </template>

        <template v-else-if="column.key === 'action'">
          <a-space>
            <a-button size="small" @click="editRow(record)">
              <template #icon><EditOutlined /></template>
              編輯
            </a-button>

            <a-popconfirm
              title="確定要刪除這筆空氣品質資料嗎？"
              ok-text="刪除"
              cancel-text="取消"
              @confirm="deleteRow(record)"
            >
              <a-button danger size="small" :loading="deletingId === record._id">
                <template #icon><DeleteOutlined /></template>
                刪除
              </a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </a-card>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import {
  createSensorData,
  deleteSensorData,
  getSensorData,
  updateSensorData,
} from '../api/airQualityApi'
import { filterSelectOption } from '../utils/select'

const props = defineProps({
  // stations 與 availableYears 由 App.vue 載入後傳入，這個元件只負責資料維護。
  stations: { type: Array, default: () => [] },
  availableYears: { type: Array, default: () => [] },
  initialStation: { type: String, default: '' },
})

// changed 代表新增、更新或刪除完成，父層收到後會刷新圖表。
const emit = defineEmits(['changed'])

// 儲存、讀取、刪除狀態分開管理，讓不同按鈕能各自顯示 loading。
const isSensorSaving = ref(false)
const isRowsLoading = ref(false)
const deletingId = ref('')
const editingId = ref('')
const sensorRows = ref([])

const currentYear = new Date().getFullYear()
// 月份固定 1 到 12。
const monthOptions = Array.from({ length: 12 }, (_, index) => index + 1)

// 表單狀態：新增與編輯都共用同一份資料。
const sensorForm = reactive({
  sitename: '',
  year: currentYear,
  month: 1,
  concentration: null,
})

const yearOptions = computed(() => {
  // 年份選項合併目前年份、表單年份與資料庫可用年份，避免編輯時選項消失。
  const years = new Set([currentYear, sensorForm.year, ...props.availableYears])
  return [...years].filter(Boolean).sort((a, b) => a - b)
})

// 後端使用 YYYYMM，例如 202607，所以送出前要把年和月組成 monitormonth。
const monitormonth = computed(() => sensorForm.year * 100 + sensorForm.month)

// Ant Design Vue table 欄位設定。
const columns = [
  { title: '測站', dataIndex: 'sitename', key: 'sitename' },
  { title: '年月', dataIndex: 'monitormonth', key: 'monitormonth' },
  { title: '濃度', dataIndex: 'concentration', key: 'concentration', align: 'right' },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

const formatMonth = (value) => {
  // 將 202607 顯示成 2026 年 7 月。
  const text = String(value)
  return `${text.slice(0, 4)} 年 ${Number(text.slice(4))} 月`
}

const resetForm = (station = sensorForm.sitename) => {
  // 新增或更新完成後清空濃度，並離開編輯模式。
  editingId.value = ''
  sensorForm.sitename = station || props.initialStation || ''
  sensorForm.concentration = null
}

const loadSensorRows = async () => {
  // 沒有選測站就不查資料，避免送出空查詢。
  if (!sensorForm.sitename) {
    sensorRows.value = []
    return
  }

  isRowsLoading.value = true

  try {
    // 查詢目前測站、目前年份的 1 到 12 月資料。
    sensorRows.value = await getSensorData({
      sitename: sensorForm.sitename,
      startYear: sensorForm.year,
      startMonth: 1,
      endYear: sensorForm.year,
      endMonth: 12,
    })
  } catch (error) {
    message.error(error.message || '空氣品質資料載入失敗。')
  } finally {
    isRowsLoading.value = false
  }
}

const submitSensorData = async () => {
  // 新增與更新共用同一個送出函式，由 editingId 判斷模式。
  isSensorSaving.value = true

  try {
    // 後端需要 sitename、itemengname、monitormonth、concentration。
    const body = {
      sitename: sensorForm.sitename,
      itemengname: 'PM2.5',
      monitormonth: monitormonth.value,
      concentration: sensorForm.concentration,
    }

    if (editingId.value) {
      // 有 editingId 代表正在編輯既有資料，呼叫 PUT。
      await updateSensorData(editingId.value, body)
      message.success('空氣品質資料已更新。')
    } else {
      // 沒有 editingId 代表新增資料，呼叫 POST。
      await createSensorData(body)
      message.success('空氣品質資料已新增。')
    }

    const changedStation = sensorForm.sitename
    resetForm(changedStation)
    await loadSensorRows()
    emit('changed', { sitename: changedStation })
  } catch (error) {
    message.error(error.message || '空氣品質資料儲存失敗。')
  } finally {
    isSensorSaving.value = false
  }
}

const editRow = (record) => {
  // 點編輯時，把表格資料帶回表單，並記住目前編輯的 _id。
  const text = String(record.monitormonth)
  editingId.value = record._id
  sensorForm.sitename = record.sitename
  sensorForm.year = Number(text.slice(0, 4))
  sensorForm.month = Number(text.slice(4))
  sensorForm.concentration = record.concentration
}

const cancelEdit = () => {
  // 取消編輯會清掉 editingId，表單回到新增模式。
  resetForm()
}

const deleteRow = async (record) => {
  // 只讓目前被刪除的那一列顯示 loading。
  deletingId.value = record._id

  try {
    // 呼叫 DELETE /api/sensor-data/:id。
    await deleteSensorData(record._id)
    message.success('空氣品質資料已刪除。')
    if (editingId.value === record._id) resetForm(record.sitename)
    await loadSensorRows()
    emit('changed', { sitename: record.sitename })
  } catch (error) {
    message.error(error.message || '空氣品質資料刪除失敗。')
  } finally {
    deletingId.value = ''
  }
}

watch(
  () => props.initialStation,
  (station) => {
    // 第一次進頁面時，若表單沒有測站，就套用主圖選到的測站。
    if (!sensorForm.sitename && station) {
      sensorForm.sitename = station
    }
  },
  { immediate: true },
)

watch(
  () => [sensorForm.sitename, sensorForm.year],
  () => {
    // 測站或年份改變時刷新表格；編輯中不自動刷新，避免表單資料被打斷。
    if (!editingId.value) loadSensorRows()
  },
  { immediate: true },
)
</script>
