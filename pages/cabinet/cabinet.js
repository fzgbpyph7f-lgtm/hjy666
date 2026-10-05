const STORAGE_KEY = 'drugList'

Page({
  data: {
    list: [],
    filteredList: [],
    total: 0,
    expiredCount: 0,
    warningCount: 0,
    activeFilter: 'all',
    filters: [
      { key: 'all', label: '全部' },
      { key: 'expired', label: '已过期' },
      { key: 'warning', label: '临期' },
      { key: 'normal', label: '正常' }
    ],
    health: {
      score: 100,
      level: 'excellent',
      tip: '药箱非常健康',
      percent: 360,
      ringColor: '#22c55e',
      bgColor: '#e6f9ef'
    }
  },

  onShow() {
    this.loadList()
  },

  loadList() {
    const list = wx.getStorageSync(STORAGE_KEY) || []
  
    const expiredCount = list.filter(d => d.status === 'expired').length
    const warningCount = list.filter(d => d.status === 'warning').length
  
    // ===== 计算健康评分 =====
    let score = 100
    score -= expiredCount * 15
    score -= warningCount * 5
    if (score < 0) score = 0
  
    let level, tip, ringColor, bgColor
    if (score >= 90) {
      level = 'excellent'; tip = '药箱非常健康'; ringColor = '#22c55e'; bgColor = '#e6f9ef'
    } else if (score >= 70) {
      level = 'good'; tip = '状态良好，继续保持'; ringColor = '#4f7cff'; bgColor = '#e6ecff'
    } else if (score >= 50) {
      level = 'warning'; tip = '有临期药品，建议优先使用'; ringColor = '#ffa726'; bgColor = '#fff8e6'
    } else {
      level = 'danger'; tip = '过期药较多，尽快清理'; ringColor = '#ff5a5a'; bgColor = '#fff1f0'
    }
  
    const percent = Math.round((score / 100) * 360)
  
    this.setData({
      list,
      expiredCount,
      warningCount,
      health: { score, level, tip, percent, ringColor, bgColor }
    })
  
    this.animateNumber(list.length, 'total')
    this.animateNumber(expiredCount, 'expiredCount')
    this.animateNumber(warningCount, 'warningCount')
  
    this.applyFilter()
  },

  // 数字从0滚动到目标值
  animateNumber(target, key) {
    const start = this.data[key] || 0
    if (start === target) return
    const duration = 500
    const steps = 20
    const delta = (target - start) / steps
    let i = 0

    // 清掉上一次可能残留的定时器
    if (this[`_timer_${key}`]) clearInterval(this[`_timer_${key}`])

    this[`_timer_${key}`] = setInterval(() => {
      i++
      if (i >= steps) {
        this.setData({ [key]: target })
        clearInterval(this[`_timer_${key}`])
      } else {
        this.setData({ [key]: Math.round(start + delta * i) })
      }
    }, duration / steps)
  },

  changeFilter(e) {
    this.setData({ activeFilter: e.currentTarget.dataset.key })
    this.applyFilter()
  },

  applyFilter() {
    const { list, activeFilter } = this.data
    const filteredList = activeFilter === 'all'
      ? list
      : list.filter(d => d.status === activeFilter)
    this.setData({ filteredList })
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定从药箱中移除这条记录吗？',
      success: (res) => {
        if (!res.confirm) return
        const list = this.data.list.filter(d => d.id !== id)
        wx.setStorageSync(STORAGE_KEY, list)
        this.loadList()
      }
    })
  },

  clearAll() {
    wx.showModal({
      title: '清空药箱',
      content: '所有记录将被删除，且不可恢复',
      confirmColor: '#ff5a5a',
      success: (res) => {
        if (!res.confirm) return
        wx.removeStorageSync(STORAGE_KEY)
        this.loadList()
      }
    })
  }
})