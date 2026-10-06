// index.js
const STORAGE_KEY = 'drugList'
const RECYCLE_KEY = 'recycleOrders'

Page({
  data: {
    step: 'front',        // front: 等拍正面 | side: 等拍侧面 | done: 识别完成
    frontImage: '',
    sideImage: '',
    frontResult: null,    // 正面识别结果
    result: null,         // 最终合并结果
    loading: false,
    useMock: false
  },

  // 拍照：根据当前 step 决定拍哪个面
  takePhoto() {
    if (this.data.step === 'done') {
      wx.showToast({ title: '已完成识别', icon: 'none' })
      return
    }

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (res) => {
        const path = res.tempFiles[0].tempFilePath

        if (this.data.step === 'front') {
          this.setData({ frontImage: path })
          this.recognizeFront(path)
        } else if (this.data.step === 'side') {
          this.setData({ sideImage: path })
          this.recognizeSide(path)
        }
      }
    })
  },

  // 第一步：识别正面
  async recognizeFront(filePath) {
    this.setData({ loading: true, result: null })

    // Mock 模式
    if (this.data.useMock) {
      setTimeout(() => {
        const front = {
          drugName: '阿莫西林胶囊',
          approvalNumber: '国药准字H20033456',
          manufacturer: '某制药有限公司',
          specification: '0.25g×24粒'
        }
        this.setData({
          loading: false,
          step: 'side',
          frontResult: front
        })
        wx.showToast({ title: '正面识别完成，请拍侧面', icon: 'none', duration: 2000 })
      }, 1500)
      return
    }

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `drugs/${Date.now()}_front.jpg`,
        filePath
      })

      const r = await wx.cloud.callFunction({
        name: 'recognizeDrug',
        data: { fileID: uploadRes.fileID, mode: 'front' }
      })

      // 删掉云存储原图
      wx.cloud.deleteFile({ fileList: [uploadRes.fileID] })

      const res = r.result
      if (!res.success) {
        wx.showToast({ title: res.msg || '正面识别失败', icon: 'none' })
        this.setData({ loading: false, step: 'front' })
        return
      }

      this.setData({
        loading: false,
        step: 'side',
        frontResult: res.data
      })
      wx.showToast({ title: '正面已识别，请拍侧面', icon: 'none', duration: 2000 })

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '网络错误', icon: 'none' })
      this.setData({ loading: false, step: 'front' })
    }
  },

  // 第二步：识别侧面，合并结果
  async recognizeSide(filePath) {
    this.setData({ loading: true })

    // Mock 模式
    if (this.data.useMock) {
      setTimeout(() => {
        const side = {
          expiryDate: '2025-03-15',
          productionDate: '2023-03-15',
          batchNumber: '20230101',
          validityMonths: 24
        }
        this.mergeAndSave(side)
      }, 1500)
      return
    }

    try {
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `drugs/${Date.now()}_side.jpg`,
        filePath
      })

      const r = await wx.cloud.callFunction({
        name: 'recognizeDrug',
        data: { fileID: uploadRes.fileID, mode: 'side' }
      })

      wx.cloud.deleteFile({ fileList: [uploadRes.fileID] })

      const res = r.result
      if (!res.success) {
        wx.showToast({ title: res.msg || '侧面识别失败', icon: 'none' })
        this.setData({ loading: false })
        return
      }

      this.mergeAndSave(res.data)

    } catch (err) {
      console.error(err)
      wx.showToast({ title: '网络错误', icon: 'none' })
      this.setData({ loading: false })
    }
  },

  // 合并正面+侧面结果
  mergeAndSave(side) {
    const front = this.data.frontResult || {}

    // 计算有效期
    let expiryDate = side.expiryDate
    if (!expiryDate && side.productionDate && side.validityMonths) {
      const d = new Date(side.productionDate)
      d.setMonth(d.getMonth() + Number(side.validityMonths))
      expiryDate = d.toISOString().slice(0, 10)
    }

    const expiry = expiryDate ? new Date(expiryDate) : null
    const now = new Date()
    const daysLeft = expiry ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24)) : null

    let status = 'unknown'
    if (daysLeft !== null) {
      if (daysLeft < 0) status = 'expired'
      else if (daysLeft <= 90) status = 'warning'
      else status = 'normal'
    }

    const result = {
      drugName: front.drugName || '未知药品',
      category: front.tradeName || '其他',
      usage: front.specification || '',
      expiryDate: expiryDate || '待补充',
      batchNumber: side.batchNumber || front.approvalNumber || '',
      daysLeft: daysLeft,
      status: status
    }

    this.setData({
      loading: false,
      step: 'done',
      result
    })
    this.saveToCabinet(result)
  },

  saveToCabinet(item) {
    const list = wx.getStorageSync(STORAGE_KEY) || []
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

  goToRecycle() {
    const order = {
      id: Date.now(),
      drugName: this.data.result.drugName,
      category: this.data.result.category,
      recycleTime: Date.now(),
      status: 'pending'
    }
    const orders = wx.getStorageSync(RECYCLE_KEY) || []
    orders.unshift(order)
    wx.setStorageSync(RECYCLE_KEY, orders)

    if (this.data.useMock) {
      wx.showModal({
        title: '预约成功',
        content: '已记录回收订单（模拟）',
        showCancel: false
      })
      return
    }

    wx.navigateToMiniProgram({
      appId: 'wx91d27dbf599dff74',
      path: 'pages/union/proxy/proxy',
      extraData: { drugName: this.data.result.drugName, source: 'yaoanxin' },
      fail: () => {
        wx.showModal({
          title: '跳转失败',
          content: '请手动打开京东App，搜索"过期药回收"预约上门取药',
          showCancel: false
        })
      }
    })
  },

  // 重头开始
  reset() {
    this.setData({
      step: 'front',
      frontImage: '',
      sideImage: '',
      frontResult: null,
      result: null
    })
  }
})