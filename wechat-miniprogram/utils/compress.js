/**
 * 图片压缩工具 - 微信小程序版本
 * 基于浏览器版移植，保持相同压缩算法
 */

// 压缩图片
function compressImage(filePath, targetSizeKB, maxWidth, maxIterations = 8) {
  return new Promise((resolve, reject) => {
    // 获取图片信息
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        let originalWidth = info.width
        let originalHeight = info.height
        
        // 计算缩放后的尺寸
        let scaledWidth = originalWidth
        let scaledHeight = originalHeight
        if (maxWidth && originalWidth > maxWidth) {
          const ratio = maxWidth / originalWidth
          scaledWidth = maxWidth
          scaledHeight = Math.round(originalHeight * ratio)
        }

        // 创建 canvas 压缩
        const canvas = wx.createCanvas()
        canvas.width = scaledWidth
        canvas.height = scaledHeight

        // 绘制图片
        const ctx = canvas.getContext('2d')
        ctx.drawImage(filePath, 0, 0, scaledWidth, scaledHeight)

        // 迭代压缩找到目标大小
        let quality = 0.9
        let bestResult = null
        let bestDiff = Infinity

        function doCompression(iteration) {
          wx.canvasToTempFilePath({
            canvas,
            quality: quality,
            fileType: 'jpg',
            success: (res) => {
              // 获取压缩后文件大小
              wx.getFileInfo({
                filePath: res.tempFilePath,
                success: (fileInfo) => {
                  const sizeKB = fileInfo.size / 1024
                  const diff = Math.abs(sizeKB - targetSizeKB)

                  if (diff < bestDiff) {
                    bestDiff = diff
                    bestResult = {
                      tempFilePath: res.tempFilePath,
                      sizeKB: sizeKB,
                      originalSizeKB: info.size / 1024,
                      width: scaledWidth,
                      height: scaledHeight
                    }
                  }

                  // 达到目标大小或者达到最大迭代次数
                  if (iteration >= maxIterations || sizeKB <= targetSizeKB) {
                    canvas = null // 释放
                    resolve(bestResult)
                    return
                  }

                  // 调整质量继续压缩
                  if (sizeKB > targetSizeKB) {
                    quality = quality * 0.8
                  } else {
                    quality = quality * 1.1
                  }
                  doCompression(iteration + 1)
                },
                fail: reject
              })
            },
            fail: reject
          })
        }

        doCompression(1)
      },
      fail: reject
    })
  })
}

// 批量压缩
function compressMultiple(filePaths, targetSizeKB, maxWidth) {
  const promises = filePaths.map(path => compressImage(path, targetSizeKB, maxWidth))
  return Promise.all(promises)
}

// 保存到相册
function saveToAlbum(tempFilePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath: tempFilePath,
      success: resolve,
      fail: reject
    })
  })
}

module.exports = {
  compressImage,
  compressMultiple,
  saveToAlbum
}
