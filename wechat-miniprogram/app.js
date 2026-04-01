App({
  onLaunch: function () {
    // 初始化存储
    if (!wx.getStorageSync('isPro')) {
      wx.setStorageSync('isPro', false)
    }
    if (!wx.getStorageSync('remainingFreeQuota')) {
      // 未登录默认5次
      wx.setStorageSync('remainingFreeQuota', 5)
    }
    if (!wx.getStorageSync('totalImages')) {
      wx.setStorageSync('totalImages', 0)
    }
  },
  
  // 获取用户统计
  getUserStats: function() {
    return {
      isPro: wx.getStorageSync('isPro') || false,
      remainingFreeQuota: wx.getStorageSync('remainingFreeQuota') || 5,
      totalImages: wx.getStorageSync('totalImages') || 0,
      totalSavedBytes: wx.getStorageSync('totalSavedBytes') || 0
    }
  },
  
  // 更新用户统计
  updateUserStats: function(operation, key, value) {
    const stats = this.getUserStats()
    if (operation === 'set') {
      stats[key] = value
    } else if (operation === 'increment') {
      stats[key] = (stats[key] || 0) + value
    }
    wx.setStorageSync(key, stats[key])
    return stats
  },

  // 检查是否还有配额
  hasRemainingQuota: function() {
    const stats = this.getUserStats()
    if (stats.isPro) return true
    const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 5
    return remaining > 0
  }
})
