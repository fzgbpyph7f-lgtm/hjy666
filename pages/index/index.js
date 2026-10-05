// index.js
const STORAGE_KEY = 'drugList'
const RECYCLE_KEY = 'recycleOrders'

Page({
  data: {
    imageUrl: '',
    result: null,
    loading: false,
    useMock: true   // 有AppID并部署云函数后改成 false
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.setData({ imageUrl: tempPath, result: null })
        this.uploadAndRecognize(tempPath)
      }
    })
  },

  async uploadAndRecognize(filePath) {
    this.setData({ loading: true })

    // ===== Mock 模式 =====
    if (this.data.useMock) {
      const mockList = [
        {
          drugName: '阿莫西林胶囊',
          category: '抗生素',
          usage: '呼吸道感染',
          expiryDate: '2025-03-15',
          batchNumber: '20230101',
          daysLeft: -200,
          status: 'expired'
        },
        {
          drugName: '布洛芬缓释胶囊',
          category: '解热镇痛',
          usage: '退烧 / 止痛',
          expiryDate: '2026-11-25',
          batchNumber: '20240315',
          daysLeft: 51,
          status: 'warning'
        },
        {
          drugName: '维生素C片',
          category: '维生素',
          usage: '补充维C',
          expiryDate: '2027-08-20',
          batchNumber: '20240901',
          daysLeft: 680,
          status: 'normal'
        }
      ]
      const pick = mockList[Math.floor(Math.random() * mockList.length)]

      setTimeout(() => {
        this.setData({ loading: false, result: pick })
        this.saveToCabinet(pick)
      }, 1500)
      return
    }

    // ===== 真实模式：调用云函数 =====
    try {
      const cloudPath = `drugs/${Date.now()}.jpg`
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath })

      const recognizeRes = await wx.cloud.callFunction({
        name: 'recognizeDrug',
        data: { fileID: uploadRes.fileID }
      })

      const res = recognizeRes.result
      if (res.code === 0) {
        this.setData({ result: res.data })
        this.saveToCabinet(res.data)
      } else {
        wx.showToast({ title: '识别失败，请重试', icon: 'none' })
      }

      wx.cloud.deleteFile({ fileList: [uploadRes.fileID] })
    } catch (err) {
      console.error(err)
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 存入本地药箱
  saveToCabinet(item) {
    const list = wx.getStorageSync(STORAGE_KEY) || []
    // 按药品名 + 批号去重
    const exists = list.some(
      d => d.drugName === item.drugName && d.batchNumber === item.batchNumber
    )
    if (exists) return

    list.unshift({
      ...item,
      id: Date.now(),
      recognizeTime: Date.now()
    })
    wx.setStorageSync(STORAGE_KEY, list)
  },

  // 跳转京东回收（同时写入回收订单）
  goToRecycle() {
    // ===== 先记录回收订单 =====
    const order = {
      id: Date.now(),
      drugName: this.data.result.drugName,
      category: this.data.result.category,
      recycleTime: Date.now(),
      status: 'pending'   // pending 待上门 / done 已回收
    }
    const orders = wx.getStorageSync(RECYCLE_KEY) || []
    orders.unshift(order)
    wx.setStorageSync(RECYCLE_KEY, orders)

    // ===== Mock 模式 =====
    if (this.data.useMock) {
      wx.showModal({
        title: '预约成功',
        content: '已记录回收订单，京东小哥将上门取药（模拟）',
        showCancel: false
      })
      return
    }

    // ===== 真实跳转京东小程序 =====
    wx.navigateToMiniProgram({
      appId: 'wx91d27dbf599dff74',
      path: 'pages/union/proxy/proxy',
      extraData: {
        drugName: this.data.result.drugName,
        source: 'yaoanxin'
      },
      fail: () => {
        wx.showModal({
          title: '跳转失败',
          content: '请手动打开京东App，搜索"过期药回收"预约上门取药',
          showCancel: false
        })
      }
    })
  },

  reset() {
    this.setData({ imageUrl: '', result: null })
  }
})