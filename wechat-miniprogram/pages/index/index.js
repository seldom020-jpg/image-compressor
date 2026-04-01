const app = getApp()
const { compressImage, saveToAlbum } = require('../../utils/compress.js')
const { getUserStats, hasRemainingQuota, consumeQuota } = require('../../utils/storage.js')

Page({
  data: {
    uploaded: false,
    previewed: false,
    compressed: false,
    processing: false,
    progress: 0,
    progressText: '',
    originalPreview: '',
    compressedPreview: '',
    originalInfo: '',
    compressedInfo: '',
    originalSize: 0,
    compressedSize: 0,
    reduced: 0,
    targetSize: 100,
    targetUnit: 'KB',
    customSize: '',
    customUnitIndex: 0,
    sizeUnits: ['KB', 'MB'],
    maxWidth: 1920,
    remaining: 5,
    isPro: false,
    compressedTempPath: ''
  },

  onLoad: function () {
    this.loadStats()
  },

  onShow: function () {
    this.loadStats()
  },

  loadStats: function () {
    const stats = getUserStats()
    this.setData({
      remaining: stats.remainingFreeQuota || 5,
      isPro: stats.isPro || false
    })
  },

  chooseImage: function () {
    const { hasRemainingQuota } = require('../../utils/storage.js')
    if (!hasRemainingQuota()) {
      wx.showModal({
        title: '额度不足',
        content: '免费额度已用完，请开通终身会员继续使用',
        confirmText: '立即开通',
        success: (res) => {
          if (res.confirm) {
            this.openUpgrade()
          }
        }
      })
      return
    }

    wx.chooseMedia({
      count: 9,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const files = res.tempFiles
        if (files.length > 0) {
          this.handleFilesSelect(files)
        }
      }
    })
  },

  handleFilesSelect: function (files) {
    this.setData({
      uploaded: true
    })

    // 单图预览
    if (files.length === 1) {
      const file = files[0]
      this.setData({
        previewed: true,
        originalPreview: file.tempFilePath,
        originalSize: (file.size / 1024).toFixed(2)
      })
      // 获取图片信息
      wx.getImageInfo({
        src: file.tempFilePath,
        success: (info) => {
          this.setData({
            originalInfo: `尺寸：${info.width} × ${info.height}`
          })
        }
      })
    }
    // 多张不预览
    this.loadStats()
  },

  selectPreset: function (e) {
    const size = parseInt(e.currentTarget.dataset.size)
    const unit = e.currentTarget.dataset.unit
    this.setData({
      targetSize: size,
      targetUnit: unit
    })
  },

  selectResolution: function (e) {
    const width = parseInt(e.currentTarget.dataset.width)
    this.setData({
      maxWidth: width
    })
  },

  onCustomSizeChange: function (e) {
    this.setData({
      customSize: e.detail.value
    })
  },

  onCustomUnitChange: function (e) {
    this.setData({
      customUnitIndex: e.detail.value
    })
  },

  openUpgrade: function () {
    // 跳转到购买页面
    wx.navigateTo({
      url: '/pages/pay/pay'
    })
  },

  startCompression: function () {
    // 获取目标大小
    let targetSizeKB = this.data.targetSize
    if (this.data.customSize) {
      const customSizeNum = parseFloat(this.data.customSize)
      const unit = this.data.sizeUnits[this.data.customUnitIndex]
      if (unit === 'MB') {
        targetSizeKB = customSizeNum * 1024
      } else {
        targetSizeKB = customSizeNum
      }
    }

    // 获取最大宽度
    const maxWidth = this.data.maxWidth || 0

    // 获取选中的图片
    // 这里简化处理，只压缩第一张
    const originalPreview = this.data.originalPreview
    if (!originalPreview) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    this.setData({
      processing: true,
      progress: 0,
      progressText: '开始压缩...'
    })

    // 消耗配额
    consumeQuota()
    this.loadStats()

    // 执行压缩
    compressImage(originalPreview, targetSizeKB, maxWidth, 8)
      .then(result => {
        const reducedPercent = ((result.originalSizeKB - result.sizeKB) / result.originalSizeKB * 100).toFixed(1)
        this.setData({
          compressed: true,
          processing: false,
          compressedPreview: result.tempFilePath,
          compressedSize: result.sizeKB.toFixed(2),
          originalSize: result.originalSizeKB.toFixed(2),
          reduced: reducedPercent,
          compressedTempPath: result.tempFilePath
        })

        wx.showToast({
          title: '压缩完成',
          icon: 'success'
        })
      })
      .catch(err => {
        console.error('压缩失败', err)
        this.setData({
          processing: false
        })
        wx.showModal({
          title: '压缩失败',
          content: err.message || '未知错误',
          showCancel: false
        })
      })
  },

  downloadResult: function () {
    saveToAlbum(this.data.compressedTempPath)
      .then(() => {
        wx.showToast({
          title: '已保存到相册',
          icon: 'success'
        })
      })
      .catch(err => {
        console.error('保存失败', err)
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      })
  }
})
