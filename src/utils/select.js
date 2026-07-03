// Ant Design Vue Select 的搜尋函式：使用者輸入文字時，比對 option 文字或 value。
export const filterSelectOption = (input, option) => {
  // option.children 可能是顯示文字，option.value 則是實際值；兩者擇一拿來搜尋。
  const label = String(option?.children?.[0]?.children ?? option?.value ?? '')

  // 不分大小寫比對，讓測站下拉選單可以用關鍵字搜尋。
  return label.toLowerCase().includes(input.toLowerCase())
}
