/**
 * 存储封装
 */

// 获取用户统计
function getUserStats() {
  return {
    isPro: wx.getStorageSync('isPro') || false,
    remainingFreeQuota: wx.getStorageSync('remainingFreeQuota') || 5,
    totalImages: wx.getStorageSync('totalImages') || 0,
    totalSavedBytes: wx.getStorageSync('totalSavedBytes') || 0
  }
}

// 更新用户统计
function updateUserStats(operation, key, value) {
  const stats = getUserStats()
  if (operation === 'set') {
    stats[key] = value
    wx.setStorageSync(key, value)
  } else if (operation === 'increment') {
    stats[key] = (stats[key] || 0) + value
    wx.setStorageSync(key, stats[key])
  }
  return stats
}

// 检查是否还有配额
function hasRemainingQuota() {
  const stats = getUserStats()
  if (stats.isPro) return true
  const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 5
  return remaining > 0
}

// 消耗一次配额
function consumeQuota() {
  const stats = getUserStats()
  if (stats.isPro) return
  let remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 5
  if (remaining > 0) {
    remaining -= 1
  }
  wx.setStorageSync('remainingFreeQuota', remaining)
  updateUserStats('increment', 'totalImages', 1)
}

// 激活会员
function activatePro() {
  wx.setStorageSync('isPro', true)
  updateUserStats('set', 'isPro', true)
  wx.setStorageSync('proActivatedAt', Date.now())
}

module.exports = {
  getUserStats,
  updateUserStats,
  hasRemainingQuota,
  consumeQuota,
  activatePro
}
