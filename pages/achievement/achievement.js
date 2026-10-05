const RECYCLE_KEY = 'recycleOrders'

Page({
  data: {
    totalCount: 0,
    carbonSaved: 0,
    soilSaved: 0,
    orders: [],
    medals: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const raw = wx.getStorageSync(RECYCLE_KEY) || []

    // 计算贡献值（按订单数估算）
    const totalCount = raw.length
    const carbonSaved = totalCount * 30       // 每盒约减碳 30g
    const soilSaved = (totalCount * 0.5).toFixed(1)  // 每盒约避免 0.5m² 土壤污染

    // 格式化订单时间
    const orders = raw.map(o => ({
      ...o,
      timeText: this.formatTime(o.recycleTime)
    }))

    // 勋章解锁逻辑
    const medals = [
      { key: 'seed',    name: '初绿使者',   desc: '回收1盒',    color: 'green', unlocked: totalCount >= 1 },
      { key: 'soil',    name: '净壤先锋',   desc: '回收3盒',    color: 'teal',  unlocked: totalCount >= 3 },
      { key: 'water',   name: '清源卫士',   desc: '回收6盒',    color: 'blue',  unlocked: totalCount >= 6 },
      { key: 'earth',   name: '地球守护者', desc: '回收10盒',   color: 'gold',  unlocked: totalCount >= 10 }
    ]

    this.setData({ totalCount, carbonSaved, soilSaved, orders, medals })
  },

  formatTime(ts) {
    const d = new Date(ts)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const mi = String(d.getMinutes()).padStart(2, '0')
    return `${mm}-${dd} ${hh}:${mi}`
  },

  goRecognize() {
    wx.switchTab({ url: '/pages/index/index' })
  }
})