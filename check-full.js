        // Google OAuth 配置和状态
        let currentUser = null;
        
        // Google One Tap 初始化
        function initGoogleLogin() {
            google.accounts.id.initialize({
                client_id: '180247334590-dmvoormlch332sagduvrv0cegeq07qcv.apps.googleusercontent.com',
                callback: handleCredentialResponse
            });
            google.accounts.id.renderButton(
                document.querySelector('.g_id_signin'),
                { theme: 'outline', size: 'large' }
            );
        }
        
        // 检查是否已经登录
        function checkAuth() {
            const savedUser = localStorage.getItem('googleUser');
            if (savedUser) {
                currentUser = JSON.parse(savedUser);
                showLoggedInUser();
                unlockContent();
                // 登录后更新配额显示
                setTimeout(() => {
                    updateQuotaWarning();
                }, 500);
            } else {
                lockContent();
            }
        }

        // 解析 JWT token
        function parseJwt(token) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
                    '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
                ).join(''));
                return JSON.parse(jsonPayload);
            } catch (e) {
                return null;
            }
        }

        // Google 登录回调
        function handleCredentialResponse(response) {
            const payload = parseJwt(response.credential);
            if (payload) {
                currentUser = {
                    id: payload.sub,
                    name: payload.name,
                    email: payload.email,
                    picture: payload.picture,
                    credential: response.credential
                };
                localStorage.setItem('googleUser', JSON.stringify(currentUser));
                showLoggedInUser();
                unlockContent();
            }
        }

        // 显示已登录用户信息
        function showLoggedInUser() {
            document.getElementById('loginPromptBox').style.display = 'none';
            document.getElementById('userInfoBox').style.display = 'block';
            document.getElementById('loginArea').classList.add('logged-in');
            document.getElementById('userInfoBox').innerHTML = `
                <div class="user-info">
                    <img src="${currentUser.picture}" class="user-avatar" alt="${currentUser.name}">
                    <span class="user-name">${currentUser.name}</span>
                    <button class="user-menu-btn" onclick="openUserCenter()">个人中心</button>
                    <button class="btn-logout" onclick="logout()">退出登录</button>
                </div>
            `;
        }

        // 退出登录
        function logout() {
            currentUser = null;
            localStorage.removeItem('googleUser');
            document.getElementById('loginPromptBox').style.display = 'block';
            document.getElementById('userInfoBox').style.display = 'none';
            document.getElementById('loginArea').classList.remove('logged-in');
            lockContent();
        }

        // 锁定内容（未登录）
        function lockContent() {
            document.getElementById('contentArea').classList.add('locked');
            document.getElementById('loginPromptOverlay').classList.add('show');
        }

        // 解锁内容（已登录）
        function unlockContent() {
            document.getElementById('contentArea').classList.remove('locked');
            document.getElementById('loginPromptOverlay').classList.remove('show');
        }

        // 页面加载时检查认证状态 + 初始化 Google 登录
        document.addEventListener('DOMContentLoaded', function() {
            checkAuth();
            // 等待 Google GSI 脚本异步加载完成后再初始化
            function tryInitGoogle() {
                if (window.google && google.accounts) {
                    initGoogleLogin();
                } else {
                    // Google 脚本还没加载好，等一会儿再试
                    setTimeout(tryInitGoogle, 200);
                }
            }
            tryInitGoogle();
        });

        let uploadedFiles = [];
        let batchResults = [];
        let compressedBlob; // 单张压缩结果
        let targetSizeBytes = 100 * 1024; // 默认100KB
        let selectedPreset = {size: 100, unit: 'KB'};
        let maxWidth = 1920; // 默认最大宽度1920px
        let selectedResolutionPreset = 1920;
        let isProcessingBatch = false;

        // 拖拽上传
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                handleFileSelect(files[0]);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFilesSelect(Array.from(e.target.files));
            }
        });

        function handleFilesSelect(files) {
            uploadedFiles = files;
            batchResults = [];
            
            // 显示设置区域
            document.getElementById('settingsArea').classList.add('show');
            
            // 如果只有一张，显示单张预览
            if (files.length === 1) {
                document.getElementById('previewArea').classList.add('show');
                handleSingleFilePreview(files[0]);
            } else {
                document.getElementById('previewArea').classList.remove('show');
            }
            
            // 显示批量列表
            renderBatchList();
            document.getElementById('batchList').classList.add('show');
            document.getElementById('compressBtn').disabled = false;
        }

        function handleSingleFilePreview(file) {
            uploadedFile = file;
            // 显示原始图片预览
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('originalPreview').src = e.target.result;
                
                // 显示信息
                const sizeKB = (file.size / 1024).toFixed(2);
                const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                const img = document.getElementById('originalPreview');
                img.onload = () => {
                    document.getElementById('originalInfo').innerHTML = `
                        文件名：${file.name}<br>
                        原始大小：${sizeKB} KB (${sizeMB} MB)<br>
                        尺寸：${img.naturalWidth} × ${img.naturalHeight}
                    `;
                };
            };
            reader.readAsDataURL(file);
        }

        function renderBatchList() {
            const tbody = document.getElementById('batchTableBody');
            tbody.innerHTML = '';
            
            uploadedFiles.forEach((file, index) => {
                const row = document.createElement('tr');
                const sizeKB = (file.size / 1024).toFixed(2);
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${file.name}</td>
                    <td>${sizeKB} KB</td>
                    <td id="batch-size-${index}">-</td>
                    <td id="batch-status-${index}"><span class="batch-status status-waiting">等待处理</span></td>
                    <td><a href="#" id="batch-download-${index}" style="display: none;" class="btn-download-small" onclick="downloadSingleBatch(${index}); return false;">下载</a></td>
                `;
                tbody.appendChild(row);
                
                // 初始化结果
                batchResults.push({
                    file: file,
                    blob: null,
                    status: 'waiting',
                    compressedSize: null
                });
            });
            
            // 显示统计
            updateTotalStats();
            document.getElementById('totalStats').classList.add('show');
        }

        function updateTotalStats() {
            const total = uploadedFiles.length;
            const done = batchResults.filter(r => r.status === 'done').length;
            const errors = batchResults.filter(r => r.status === 'error').length;
            const processing = batchResults.filter(r => r.status === 'processing').length;
            
            let html = `
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
                    <div style="background: white; padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">总张数</div>
                        <div style="font-size: 18px; font-weight: bold; color: #1e3c72;">${total}</div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">已完成</div>
                        <div style="font-size: 18px; font-weight: bold; color: #28a745;">${done}</div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">处理中</div>
                        <div style="font-size: 18px; font-weight: bold; color: #004085;">${processing}</div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 6px; text-align: center;">
                        <div style="font-size: 11px; color: #666;">失败</div>
                        <div style="font-size: 18px; font-weight: bold; color: #dc3545;">${errors}</div>
                    </div>
                </div>
            `;
            
            document.getElementById('totalStatsContent').innerHTML = html;
            
            // 全部完成后显示打包下载
            if (done === total && total > 1) {
                document.getElementById('batchActions').classList.add('show');
            } else {
                document.getElementById('batchActions').classList.remove('show');
            }
        }

        function selectPreset(size, unit) {
            // 移除active
            document.querySelectorAll('.size-option').forEach(el => el.classList.remove('active'));
            // 添加active到点击的元素
            event.target.closest('.size-option').classList.add('active');
            
            selectedPreset = {size, unit};
            updateTargetSize();
        }

        function updateTargetSize() {
            const customSize = document.getElementById('customSize').value;
            const customUnit = document.getElementById('customUnit').value;
            
            if (customSize) {
                // 使用自定义
                const size = parseFloat(customSize);
                const unit = customUnit;
                if (unit === 'KB') {
                    targetSizeBytes = size * 1024;
                } else {
                    targetSizeBytes = size * 1024 * 1024;
                }
            } else {
                // 使用预设
                const size = selectedPreset.size;
                const unit = selectedPreset.unit;
                if (unit === 'KB') {
                    targetSizeBytes = size * 1024;
                } else {
                    targetSizeBytes = size * 1024 * 1024;
                }
            }
        }

        // 自定义输入变化时更新
        document.getElementById('customSize').addEventListener('input', updateTargetSize);
        document.getElementById('customUnit').addEventListener('change', updateTargetSize);

        function selectResolutionPreset(preset) {
            // 移除active
            document.querySelectorAll('.resolution-option').forEach(el => el.classList.remove('active'));
            // 添加active到点击的元素
            event.target.closest('.resolution-option').classList.add('active');
            
            selectedResolutionPreset = preset;
            updateMaxWidth();
        }

        function updateMaxWidth() {
            const customMaxWidth = document.getElementById('customMaxWidth').value;
            
            if (customMaxWidth) {
                // 使用自定义
                maxWidth = parseInt(customMaxWidth);
            } else if (selectedResolutionPreset === 'original') {
                // 保持原图
                maxWidth = null;
            } else {
                // 使用预设
                maxWidth = selectedResolutionPreset;
            }
        }

        // 自定义输入变化时更新
        document.getElementById('customMaxWidth').addEventListener('input', updateMaxWidth);

        function formatBytes(bytes) {
            if (bytes < 1024) {
                return bytes + ' B';
            } else if (bytes < 1024 * 1024) {
                return (bytes / 1024).toFixed(2) + ' KB';
            } else {
                return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
            }
        }

        async function startCompression() {
            updateTargetSize();
            updateMaxWidth();

            // 检查配额
            if (!hasRemainingQuota()) {
                alert(i18n[currentLang].quotaExhaustedAlert);
                openUpgradeModal();
                return;
            }
            
            if (uploadedFiles.length === 0) {
                alert(i18n[currentLang].pleaseUploadFirst);
                return;
            }

            isProcessingBatch = true;
            document.getElementById('progressArea').classList.add('show');
            document.getElementById('compressionResult').classList.remove('show');
            document.getElementById('compressBtn').disabled = true;
            
            const outputFormat = document.getElementById('outputFormat').value;
            const maxIterations = parseInt(document.getElementById('maxIterations').value);

            try {
                if (uploadedFiles.length === 1) {
                    // 单张处理
                    updateBatchStatus(0, 'processing');
                    updateTotalStats();
                    
                    compressedBlob = await compressImageToSize(
                        uploadedFiles[0], 
                        targetSizeBytes, 
                        outputFormat, 
                        maxIterations,
                        (progress, currentQuality, currentSize) => {
                            document.getElementById('progressFill').style.width = progress + '%';
                            document.getElementById('progressText').textContent = 
                                `迭代中... 当前质量：${Math.round(currentQuality * 100)}%，当前大小：${formatBytes(currentSize)} / 目标：${formatBytes(targetSizeBytes)}`;
                        }
                    );
                    batchResults[0].blob = compressedBlob;
                    batchResults[0].status = 'done';
                    updateBatchResult(0, compressedBlob);
                    // 显示单张结果
                    document.getElementById('previewArea').classList.add('show');
                    showSingleResult();
                } else {
                    // 批量处理
                    let processed = 0;
                    for (let i = 0; i < uploadedFiles.length; i++) {
                        updateBatchStatus(i, 'processing');
                        updateTotalStats();
                        
                        document.getElementById('progressFill').style.width = (processed + 1) / uploadedFiles.length * 100 + '%';
                        document.getElementById('progressText').textContent = 
                            `正在处理第 ${processed + 1}/${uploadedFiles.length} 张：${uploadedFiles[i].name}`;
                        
                        try {
                            const blob = await compressImageToSize(
                                uploadedFiles[i],
                                targetSizeBytes,
                                outputFormat,
                                maxIterations,
                                () => {} // 单张内不显示细节进度
                            );
                            batchResults[i].blob = blob;
                            batchResults[i].status = 'done';
                            updateBatchResult(i, blob);
                        } catch (error) {
                            batchResults[i].status = 'error';
                            updateBatchStatus(i, 'error');
                            console.error('压缩失败:', error);
                        }
                        
                        processed++;
                        updateTotalStats();
                    }
                    
                    // 全部完成后，如果第一张显示预览
                    if (batchResults.length > 0 && batchResults[0].status === 'done') {
                        compressedBlob = batchResults[0].blob;
                        handleSingleFilePreview(uploadedFiles[0]);
                        document.getElementById('compressedPreview').src = URL.createObjectURL(compressedBlob);
                        document.getElementById('previewArea').classList.add('show');
                        showSingleResult();
                    }
                }

                // 消耗配额并保存历史记录 - 移到try内部确保所有await正确
                for (let i = 0; i < uploadedFiles.length; i++) {
                    if (batchResults[i].status === 'done' && batchResults[i].blob) {
                        // 消耗一次配额（每张图片算一次）
                        await consumeQuota();

                        // 保存到历史记录
                        const file = uploadedFiles[i];
                        const blob = batchResults[i].blob;
                        const originalSize = file.size;
                        const compressedSize = blob.size;
                        const outputFormat = document.getElementById('outputFormat').value;
                        let ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
                        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                        const downloadName = `${nameWithoutExt}_compressed.${ext}`;
                        const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 
                                   outputFormat === 'png' ? 'image/png' : 'image/webp';

                        await saveCompressionHistory({
                            fileName: file.name,
                            originalSize: originalSize,
                            compressedSize: compressedSize,
                            downloadName: downloadName,
                            mimeType: mime,
                            blob: blob
                        });
                    }
                }

                // 保存最后设置
                saveLastSettings();
                // 更新配额显示
                if (currentUser) {
                    await renderUserProfile();
                }

            } catch (error) {
                console.error('压缩失败:', error);
                alert(i18n[currentLang].compressionFailed + error.message);
            } finally {
                document.getElementById('progressArea').classList.remove('show');
                document.getElementById('compressBtn').disabled = false;
                isProcessingBatch = false;
            }
        }

        function updateBatchStatus(index, status) {
            batchResults[index].status = status;
            const cell = document.getElementById(`batch-status-${index}`);
            const statusClass = {
                'waiting': 'status-waiting',
                'processing': 'status-processing',
                'done': 'status-done',
                'error': 'status-error'
            };
            const statusText = {
                'waiting': '等待处理',
                'processing': '处理中',
                'done': '已完成',
                'error': '失败'
            };
            cell.innerHTML = `<span class="batch-status ${statusClass[status]}">${statusText[status]}</span>`;
        }

        function updateBatchResult(index, blob) {
            const sizeCell = document.getElementById(`batch-size-${index}`);
            sizeCell.textContent = formatBytes(blob.size);
            
            // 确保下载按钮出现时状态已经是已完成
            updateBatchStatus(index, 'done');
            
            const downloadLink = document.getElementById(`batch-download-${index}`);
            downloadLink.style.display = 'inline';
            
            updateTotalStats();
            if (batchResults.every(r => r.status === 'done' || r.status === 'error')) {
                document.getElementById('batchActions').classList.add('show');
            }
        }

        function downloadSingleBatch(index) {
            const result = batchResults[index];
            if (!result.blob) return;
            
            const originalName = result.file.name;
            const outputFormat = document.getElementById('outputFormat').value;
            let ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
            const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
            const downloadName = `${nameWithoutExt}_compressed.${ext}`;
            
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
            a.click();
            URL.revokeObjectURL(url);
        }

        async function downloadAllZip() {
            // JSZip已在head中引入，检查是否加载完成
            if (typeof JSZip === 'undefined') {
                // 尝试等待加载
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (typeof JSZip === 'undefined') {
                    alert(i18n[currentLang].jszipLoadFailed);
                    return;
                }
            }
            
            const zip = new JSZip();
            const outputFormat = document.getElementById('outputFormat').value;
            let ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
            
            // 添加所有完成的图片到zip
            batchResults.forEach((result, index) => {
                if (result.status === 'done' && result.blob) {
                    const originalName = result.file.name;
                    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
                    const fileName = `${nameWithoutExt}_compressed.${ext}`;
                    zip.file(fileName, result.blob);
                }
            });
            
            // 生成zip并下载
            const content = await zip.generateAsync({type: 'blob'});
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = `compressed-images-${new Date().getTime()}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function showSingleResult() {
            if (!compressedBlob) return;
            
            document.getElementById('compressionResult').classList.add('show');
            
            const originalSize = uploadedFiles[0].size;
            const compressedSize = compressedBlob.size;
            const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            const outputFormat = document.getElementById('outputFormat').value;
            
            // 获取原始图片尺寸
            const originalWidth = document.getElementById('originalPreview').naturalWidth;
            const originalHeight = document.getElementById('originalPreview').naturalHeight;
            
            // 计算输出尺寸
            let outputWidth = originalWidth;
            let outputHeight = originalHeight;
            if (maxWidth && originalWidth > maxWidth) {
                const ratio = originalHeight / originalWidth;
                outputWidth = maxWidth;
                outputHeight = Math.round(maxWidth * ratio);
            }
            
            let resolutionText = `${outputWidth} × ${outputHeight}`;
            if (outputWidth === originalWidth && outputHeight === originalHeight) {
                resolutionText += ' (原图)'
            }
            
            document.getElementById('compressedInfo').innerHTML = `
                大小：${formatBytes(compressedSize)}<br>
                分辨率：${resolutionText}<br>
                压缩率：${compressionRatio}%<br>
                格式：${outputFormat.toUpperCase()}
            `;
            
            const url = URL.createObjectURL(compressedBlob);
            document.getElementById('compressedPreview').src = url;
            
            // 结果统计
            const stats = [
                { label: '原始大小', value: formatBytes(originalSize) },
                { label: '目标大小', value: formatBytes(targetSizeBytes) },
                { label: '压缩后', value: formatBytes(compressedSize), success: true },
                { label: '减少了', value: compressionRatio + '%' }
            ];
            
            // 如果调整了分辨率，添加分辨率信息
            if (outputWidth !== originalWidth) {
                stats.push({ 
                    label: '分辨率', 
                    value: `${originalWidth}×${originalHeight} → ${outputWidth}×${outputHeight}`
                });
            }
            
            const html = stats.map(s => `
                <div class="stat-box">
                    <div class="stat-label">${s.label}</div>
                    <div class="stat-value${s.success ? ' success' : ''}">${s.value}</div>
                </div>
            `).join('');
            
            document.getElementById('resultStats').innerHTML = html;
        }

        async function compressImageToSize(file, targetSizeBytes, outputFormat, maxIterations, onProgress) {
            // 加载图片到canvas
            const img = await loadImage(file);
            
            let quality = 0.9;
            let minQuality = 0.1;
            let maxQuality = 1.0;
            let currentBlob = null;
            let bestBlob = null;
            let bestSizeDiff = Infinity;

            for (let i = 0; i < maxIterations; i++) {
                currentBlob = await canvasResizeAndCompress(img, quality, outputFormat);
                const currentSize = currentBlob.size;
                const sizeDiff = targetSizeBytes - currentSize;
                
                // 记录最好的结果（在不超过目标大小的情况下尽可能大）
                if (currentSize <= targetSizeBytes && targetSizeBytes - currentSize < bestSizeDiff) {
                    bestSizeDiff = targetSizeBytes - currentSize;
                    bestBlob = currentBlob;
                }
                
                // 二分法调整质量
                if (currentSize > targetSizeBytes) {
                    // 太大了，需要更低质量
                    maxQuality = quality;
                    quality = (minQuality + quality) / 2;
                } else {
                    // 太小了，可以更高质量
                    minQuality = quality;
                    quality = (quality + maxQuality) / 2;
                }
                
                onProgress((i + 1) / maxIterations * 100, quality, currentSize);
                
                // 如果已经非常接近，提前退出
                if (bestBlob && Math.abs((bestBlob.size - targetSizeBytes) / targetSizeBytes) < 0.1) {
                    break;
                }
            }
            
            // 如果没有找到比目标小的，使用最后一个（即使大一点）
            return bestBlob || currentBlob;
        }

        function loadImage(file) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        }

        function canvasResizeAndCompress(img, quality, outputFormat) {
            return new Promise((resolve) => {
                const canvas = document.createElement('canvas');
                
                // 根据设置调整分辨率
                let targetWidth = img.naturalWidth;
                let targetHeight = img.naturalHeight;
                
                if (maxWidth && img.naturalWidth > maxWidth) {
                    // 需要缩放，按比例计算高度
                    const ratio = img.naturalHeight / img.naturalWidth;
                    targetWidth = maxWidth;
                    targetHeight = Math.round(maxWidth * ratio);
                }
                // 如果原图宽度已经小于设定最大宽度，保持原样
                
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                
                const ctx = canvas.getContext('2d');
                // 白色背景（针对透明png转jpeg）
                if (outputFormat === 'jpeg') {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                // 绘制缩放后的图片
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                
                const mime = outputFormat === 'jpeg' ? 'image/jpeg' : 
                           outputFormat === 'png' ? 'image/png' : 'image/webp';
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                    URL.revokeObjectURL(img.src);
                }, mime, quality);
            });
        }

        function showResult() {
            if (!compressedBlob) return;
            
            document.getElementById('compressionResult').classList.add('show');
            
            // 显示压缩后预览
            const url = URL.createObjectURL(compressedBlob);
            document.getElementById('compressedPreview').src = url;
            
            const originalSize = uploadedFile.size;
            const compressedSize = compressedBlob.size;
            const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            
            const outputFormat = document.getElementById('outputFormat').value;
            document.getElementById('compressedInfo').innerHTML = `
                大小：${formatBytes(compressedSize)}<br>
                压缩率：${compressionRatio}%<br>
                格式：${outputFormat.toUpperCase()}
            `;
            
            // 结果统计
            const stats = [
                { label: '原始大小', value: formatBytes(originalSize) },
                { label: '目标大小', value: formatBytes(targetSizeBytes) },
                { label: '压缩后', value: formatBytes(compressedSize), success: true },
                { label: '减少了', value: compressionRatio + '%' }
            ];
            
            const html = stats.map(s => `
                <div class="stat-box">
                    <div class="stat-label">${s.label}</div>
                    <div class="stat-value${s.success ? ' success' : ''}">${s.value}</div>
                </div>
            `).join('');
            
            document.getElementById('resultStats').innerHTML = html;
        }

        // ============ 用户中心和数据存储功能 ============

        // 初始化 IndexedDB 存储压缩历史
        let db = null;
        function initDB() {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('ImageCompressorDB', 1);
                request.onerror = () => {
                    console.error('IndexedDB open failed');
                    reject(request.error);
                };
                request.onsuccess = () => {
                    db = request.result;
                    console.log('IndexedDB opened successfully');
                    resolve(db);
                };
                request.onupgradeneeded = (e) => {
                    db = e.target.result;
                    console.log('Creating object stores');
                    if (!db.objectStoreNames.contains('compressionHistory')) {
                        db.createObjectStore('compressionHistory', { keyPath: 'id', autoIncrement: true });
                    }
                    if (!db.objectStoreNames.contains('userStats')) {
                        db.createObjectStore('userStats', { keyPath: 'id' });
                    }
                };
            });
        }

        // 保存压缩历史记录
        async function saveCompressionHistory(record) {
            const preferences = loadPreferences();
            if (!preferences.saveHistory) return;

            // 确保 DB 已经初始化完成，如果还没好就等待
            if (!db) {
                try {
                    db = await initDB();
                } catch (e) {
                    console.error('DB init failed when saving history:', e);
                    return; // DB 初始化失败也不影响压缩，只是不保存历史
                }
            }

            // 获取 blob 数据
            const arrayBuffer = await record.blob.arrayBuffer();
            const recordToSave = {
                ...record,
                blobData: arrayBuffer,
                timestamp: Date.now()
            };

            return new Promise((resolve, reject) => {
                const transaction = db.transaction('compressionHistory', 'readwrite');
                const store = transaction.objectStore('compressionHistory');
                store.add(recordToSave);
                transaction.oncomplete = async () => {
                    await updateUserStats('increment', 'totalImages', 1);
                    await updateUserStats('add', 'totalSavedBytes', record.originalSize - record.compressedSize);
                    resolve();
                };
                transaction.onerror = reject;
            });
        }

        // 获取所有压缩历史
        async function getAllCompressionHistory() {
            // 确保 DB 已经初始化完成
            if (!db) {
                try {
                    db = await initDB();
                } catch (e) {
                    console.error('DB init failed:', e);
                    return [];
                }
            }
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('compressionHistory', 'readonly');
                const store = transaction.objectStore('compressionHistory');
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result.sort((a, b) => b.timestamp - a.timestamp));
                request.onerror = reject;
            });
        }

        // 删除单条历史
        async function deleteCompressionHistory(id) {
            // 确保 DB 已经初始化完成
            if (!db) {
                try {
                    db = await initDB();
                } catch (e) {
                    console.error('DB init failed:', e);
                    return;
                }
            }
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('compressionHistory', 'readwrite');
                const store = transaction.objectStore('compressionHistory');
                store.delete(id);
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        }

        // 清空所有历史
        async function clearAllCompressionHistory() {
            // 确保 DB 已经初始化完成
            if (!db) {
                try {
                    db = await initDB();
                } catch (e) {
                    console.error('DB init failed:', e);
                    return;
                }
            }
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('compressionHistory', 'readwrite');
                const store = transaction.objectStore('compressionHistory');
                store.clear();
                transaction.oncomplete = resolve;
                transaction.onerror = reject;
            });
        }

        // 获取用户统计 - 使用localStorage更简单可靠
        function getUserStats() {
            try {
                const saved = localStorage.getItem('userStats');
                if (saved) {
                    const stats = JSON.parse(saved);
                    // 填充默认值
                    if (stats.remainingFreeQuota === undefined) {
                        stats.remainingFreeQuota = 30;
                    }
                    if (stats.isPro === undefined) {
                        stats.isPro = false;
                    }
                    if (stats.totalImages === undefined) {
                        stats.totalImages = 0;
                    }
                    if (stats.totalSavedBytes === undefined) {
                        stats.totalSavedBytes = 0;
                    }
                    console.log('Loaded user stats from localStorage:', stats);
                    return stats;
                }
            } catch (e) {
                console.error('Failed to load stats', e);
            }

            // 默认值
            const defaultStats = {
                totalImages: 0,
                totalSavedBytes: 0,
                firstUse: Date.now(),
                isPro: false,
                remainingFreeQuota: 30
            };
            console.log('No saved stats, using default:', defaultStats);
            return defaultStats;
        }

        // 更新用户统计 - 保存到localStorage
        async function updateUserStats(operation, key, value) {
            const stats = getUserStats();
            if (operation === 'increment') {
                stats[key] = (stats[key] || 0) + value;
            } else if (operation === 'add') {
                stats[key] = (stats[key] || 0) + value;
            } else {
                stats[key] = value;
            }
            try {
                localStorage.setItem('userStats', JSON.stringify(stats));
                console.log('User stats saved to localStorage:', stats);
            } catch (e) {
                console.error('Failed to save stats', e);
            }
        }

        // 加载用户偏好
        function loadPreferences() {
            const saved = localStorage.getItem('userPreferences');
            const defaultPrefs = {
                saveHistory: true,
                rememberSettings: true,
                autoDownload: false
            };
            if (!saved) return defaultPrefs;
            return {...defaultPrefs, ...JSON.parse(saved)};
        }

        // 保存用户偏好
        function savePreferences() {
            const prefs = {
                saveHistory: document.getElementById('prefSaveHistory').checked,
                rememberSettings: document.getElementById('prefRememberSettings').checked,
                autoDownload: document.getElementById('prefAutoDownload').checked
            };
            localStorage.setItem('userPreferences', JSON.stringify(prefs));
        }

        // 清除所有用户数据
        function clearAllUserData() {
            if (!confirm(i18n[currentLang].confirmClearAllData)) {
                return;
            }
            clearAllCompressionHistory().then(() => {
                localStorage.removeItem('googleUser');
                localStorage.removeItem('userPreferences');
                localStorage.removeItem('lastSettings');
                localStorage.removeItem('userStats');
                // 重置IndexedDB
                indexedDB.deleteDatabase('ImageCompressorDB');
                alert('所有数据已清除，页面将刷新');
                location.reload();
            });
        }

        // 打开个人中心
        function openUserCenter() {
            document.getElementById('userCenterModal').classList.add('show');
            setTimeout(() => {
                renderUserProfile();
                loadHistoryList();
            }, 100);
        }

        // 关闭个人中心
        function closeUserCenter() {
            document.getElementById('userCenterModal').classList.remove('show');
        }

        // 切换标签页
        function switchTab(tabName) {
            document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelector(`.tab-item[data-tab="${tabName}"]`).classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        }

        // 渲染用户信息卡片
        async function renderUserProfile() {
            if (!currentUser) {
                console.log('currentUser is null, skip render');
                return;
            }
            const stats = await getUserStats();
            const totalSavedKB = (stats.totalSavedBytes / 1024).toFixed(2);
            const totalSavedMB = (stats.totalSavedBytes / (1024 * 1024)).toFixed(2);
            const savedDisplay = stats.totalSavedBytes > 1024 * 1024 ? `${totalSavedMB} MB` : `${totalSavedKB} KB`;

            // 计算剩余配额显示
            let remainingHtml = '';
            let remainingClass = 'user-stat-value';
            if (stats.isPro) {
                remainingHtml = '<div class="user-stat-value unlimited">∞</div>';
                remainingClass = 'user-stat-label';
            } else {
                const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 30;
                if (remaining <= 5) {
                    remainingClass = 'user-stat-value low';
                }
                remainingHtml = `<div class="${remainingClass}">${remaining}</div>`;
            }

            const badgeClass = stats.isPro ? 'badge-pro' : 'badge-free';
            const badgeText = stats.isPro ? '✓ 终身会员' : '免费用户';

            const html = `
                <img src="${currentUser.picture}" class="user-profile-avatar" alt="avatar">
                <div class="user-profile-info">
                    <h3>${currentUser.name} <span class="user-badge ${badgeClass}">${badgeText}</span></h3>
                    <p>${currentUser.email}</p>
                    <div class="user-stats">
                        <div class="user-stat-item">
                            <div class="user-stat-value">${stats.totalImages}</div>
                            <div class="user-stat-label">已压缩</div>
                        </div>
                        <div class="user-stat-item">
                            ${remainingHtml}
                            <div class="${remainingClass}">剩余次数</div>
                        </div>
                        <div class="user-stat-item">
                            <div class="user-stat-value">${savedDisplay}</div>
                            <div class="user-stat-label">已节省</div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('profileCard').innerHTML = html;

            // 渲染会员中心
            renderSubscriptionCard(stats);
        }

        // 渲染会员中心卡片
        function renderSubscriptionCard(stats) {
            let html = '';
            let btnHtml = '';

            if (stats.isPro) {
                html = `
                    <h3 style="color: #28a745; margin-bottom: 15px;">🎉 感谢您支持我们！</h3>
                    <p style="font-size: 16px; color: #333; margin-bottom: 10px;">您已激活 <strong>终身无限次</strong> 会员资格</p>
                    <ul style="color: #666; line-height: 2;">
                        <li>✓ 无限次图片压缩</li>
                        <li>✓ 所有功能永久可用</li>
                        <li>✓ 未来更新免费升级</li>
                    </ul>
                    <p style="color: #666; margin-top: 15px;">激活时间：${new Date(stats.proActivatedAt || Date.now()).toLocaleDateString()}</p>
                `;
                btnHtml = '';
            } else {
                const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 30;
                const color = remaining <= 5 ? '#dc3545' : '#667eea';
                const t = i18n[currentLang];
                let remainingText = t.remainingCompressions;
                remainingText = remainingText.replace('{{color}}', color);
                remainingText = remainingText.replace('${remaining}', remaining);
                html = `
                    <h3 style="color: #1e3c72; margin-bottom: 15px;">${t.freeTrial}</h3>
                    <p style="font-size: 16px; color: #333; margin-bottom: 15px;">
                        ${remainingText}
                    </p>
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 15px 0;">
                        <h4 style="color: #1e3c72; margin-bottom: 10px;">${t.upgradeToLifetime} <span style="color: #f5576c; font-size: 28px; font-weight: bold;">$9.9</span></h4>
                        <ul style="color: #666; line-height: 2; padding-left: 20px;">
                            <li>${t.proBenefit1}</li>
                            <li>${t.proBenefit2}</li>
                            <li>${t.proBenefit3}</li>
                            <li>${t.proBenefit4}</li>
                        </ul>
                    </div>
                `;
                btnHtml = `<button class="btn-upgrade" style="font-size: 16px; padding: 12px 40px;" onclick="openUpgradeModal()">${t.upgradeNow}</button>`;
            }

            document.getElementById('subscriptionCard').innerHTML = html;
            document.getElementById('upgradeBtnContainer').innerHTML = btnHtml;
        }

        // 检查是否还有可用配额
        function hasRemainingQuota() {
            const stats = getUserStats();
            if (stats.isPro) return true;
            const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 30;
            return remaining > 0;
        }

        // 消耗一次配额
        function consumeQuota() {
            const stats = getUserStats();
            if (stats.isPro) return;

            let remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 30;
            if (remaining > 0) {
                remaining -= 1;
            }

            console.log('Consuming quota, remaining:', remaining);
            updateUserStats('set', 'remainingFreeQuota', remaining);
            updateUserStats('increment', 'totalImages', 1);
            updateQuotaWarning();
            if (currentUser) {
                renderUserProfile();
            }
        }

        // 更新配额警告显示
        function updateQuotaWarning() {
            const stats = getUserStats();
            const remaining = stats.remainingFreeQuota !== undefined ? stats.remainingFreeQuota : 30;
            if (stats.isPro || remaining > 0) {
                document.getElementById('quotaWarning').classList.remove('show');
            } else {
                document.getElementById('quotaWarning').classList.add('show');
            }
        }

        // 激活会员（用户支付后）
        function activatePro() {
            updateUserStats('set', 'isPro', true);
            updateUserStats('set', 'proActivatedAt', Date.now());
            renderUserProfile();
            updateQuotaWarning();
            alert('🎉 恭喜！会员已激活，现在可以无限次使用了！');
            closeUpgradeModal();
        }

        // 打开升级弹窗 - PayPal 支付
        function openUpgradeModal() {
            // 创建一个新的弹窗用于PayPal支付
            const modal = document.createElement('div');
            modal.id = 'paymentModalOverlay';
            modal.className = 'modal-overlay show';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h2>💎 升级终身会员</h2>
                        <button class="modal-close" onclick="closeUpgradeModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="payment-modal">
                            <div class="payment-info">
                                <h3>终身无限次使用</h3>
                                <div class="payment-price">$9.90 USD</div>
                                <div class="payment-desc">一次付费，永久使用，所有功能免费更新</div>
                            </div>
                            <div class="paypal-container" id="paypal-button-container" style="margin: 20px 0;">
                                <!-- PayPal按钮会渲染在这里 -->
                            </div>
                            <div class="payment-hint">
                                <p>🔒 PayPal 安全支付，支持信用卡/借记卡</p>
                                <p>支付成功后会自动激活会员，无需手动确认</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // 渲染PayPal按钮
            setTimeout(() => {
                if (window.paypal) {
                    paypal.Buttons({
                        createOrder: function(data, actions) {
                            return actions.order.create({
                                purchase_units: [{
                                    amount: {
                                        value: '9.90',
                                        currency_code: 'USD'
                                    },
                                    description: '图片压缩工具 - 终身会员'
                                }]
                            });
                        },
                        onApprove: function(data, actions) {
                            return actions.order.capture().then(function(details) {
                                // 支付成功，激活会员
                                activatePro();
                                console.log('Payment completed by', details.payer.name.given_name);
                            });
                        },
                        onError: function(err) {
                            console.error('PayPal error:', err);
                            alert(i18n[currentLang].paymentError);
                        }
                    }).render('#paypal-button-container');
                } else {
                    // 如果PayPal SDK还没加载完成
                    setTimeout(() => {
                        if (!window.paypal) {
                            alert(i18n[currentLang].paypalLoadFailed);
                        }
                    }, 2000);
                }
            }, 100);
        }

        // 关闭升级弹窗
        function closeUpgradeModal() {
            const modal = document.getElementById('paymentModalOverlay');
            if (modal) {
                modal.remove();
            }
        }

        // 加载历史列表
        async function loadHistoryList() {
            const history = await getAllCompressionHistory();
            const container = document.getElementById('historyList');

            if (history.length === 0) {
                container.innerHTML = `
                    <div class="empty-history">
                        <p>暂无压缩历史记录</p>
                        <p style="font-size: 13px; margin-top: 10px; color: #999;">压缩完成后会自动保存到这里</p>
                    </div>
                `;
                return;
            }

            let html = `
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>文件名</th>
                            <th>原始大小</th>
                            <th>压缩后</th>
                            <th>压缩率</th>
                            <th>时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            history.forEach(item => {
                const ratio = ((1 - item.compressedSize / item.originalSize) * 100).toFixed(1);
                const date = new Date(item.timestamp).toLocaleString();
                html += `
                    <tr>
                        <td>${item.fileName}</td>
                        <td>${formatBytes(item.originalSize)}</td>
                        <td>${formatBytes(item.compressedSize)}</td>
                        <td>${ratio}%</td>
                        <td style="font-size: 12px; color: #666;">${date}</td>
                        <td>
                            <button class="btn-download-history" onclick="downloadHistoryItem(${item.id})">下载</button>
                            <button class="btn-delete-history" onclick="deleteHistoryItem(${item.id})">删除</button>
                        </td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            container.innerHTML = html;
        }

        // 下载历史记录中的图片
        async function downloadHistoryItem(id) {
            const history = await getAllCompressionHistory();
            const item = history.find(h => h.id === id);
            if (!item) return;

            const blob = new Blob([item.blobData], { type: item.mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = item.downloadName;
            a.click();
            URL.revokeObjectURL(url);
        }

        // 删除历史记录
        async function deleteHistoryItem(id) {
            if (!confirm(i18n[currentLang].confirmDeleteRecord)) return;
            await deleteCompressionHistory(id);
            await loadHistoryList();
            await renderUserProfile();
        }

        // 清空所有历史
        async function clearAllHistory() {
            if (!confirm(i18n[currentLang].confirmClearHistory)) return;
            await clearAllCompressionHistory();
            // 重置统计
            updateUserStats('set', 'totalImages', 0);
            updateUserStats('set', 'totalSavedBytes', 0);
            await loadHistoryList();
            await renderUserProfile();
        }

        // 记住上次设置
        function saveLastSettings() {
            const prefs = loadPreferences();
            if (!prefs.rememberSettings) return;

            const settings = {
                targetSize: {
                    preset: selectedPreset,
                    customSize: document.getElementById('customSize').value,
                    customUnit: document.getElementById('customUnit').value
                },
                resolution: {
                    preset: selectedResolutionPreset,
                    customMaxWidth: document.getElementById('customMaxWidth').value
                },
                outputFormat: document.getElementById('outputFormat').value,
                maxIterations: document.getElementById('maxIterations').value
            };
            localStorage.setItem('lastSettings', JSON.stringify(settings));
        }

        // 恢复上次设置
        function loadLastSettings() {
            const prefs = loadPreferences();
            if (!prefs.rememberSettings) return;

            const saved = localStorage.getItem('lastSettings');
            if (!saved) return;

            const settings = JSON.parse(saved);

            // 恢复目标大小
            if (settings.targetSize) {
                selectedPreset = settings.targetSize.preset;
                document.getElementById('customSize').value = settings.targetSize.customSize || '';
                document.getElementById('customUnit').value = settings.targetSize.customUnit || 'KB';

                // 更新预设UI
                document.querySelectorAll('.size-option').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.size-option')[getPresetIndex(settings.targetSize.preset)].classList.add('active');
                updateTargetSize();
            }

            // 恢复分辨率
            if (settings.resolution) {
                selectedResolutionPreset = settings.resolution.preset;
                document.getElementById('customMaxWidth').value = settings.resolution.customMaxWidth || '';

                // 更新预设UI
                document.querySelectorAll('.resolution-option').forEach(el => el.classList.remove('active'));
                document.querySelectorAll('.resolution-option')[getResolutionPresetIndex(settings.resolution.preset)].classList.add('active');
                updateMaxWidth();
            }

            // 恢复输出格式和迭代次数
            if (settings.outputFormat) {
                document.getElementById('outputFormat').value = settings.outputFormat;
            }
            if (settings.maxIterations) {
                document.getElementById('maxIterations').value = settings.maxIterations;
            }
        }

        function getPresetIndex(preset) {
            const presets = [
                {size: 100, unit: 'KB'},
                {size: 200, unit: 'KB'},
                {size: 500, unit: 'KB'},
                {size: 1, unit: 'MB'},
                {size: 2, unit: 'MB'},
                {size: 5, unit: 'MB'}
            ];
            return presets.findIndex(p => p.size === preset.size && p.unit === preset.unit);
        }

        function getResolutionPresetIndex(preset) {
            const presets = ['original', 1920, 1280, 960, 640, 480];
            return presets.findIndex(p => p === preset);
        }

        // 点击模态框遮罩关闭
        document.getElementById('userCenterModal').addEventListener('click', (e) => {
            if (e.target.id === 'userCenterModal') {
                closeUserCenter();
            }
        });

        // 页面加载初始化
        document.addEventListener('DOMContentLoaded', function() {
            initDB().then((initializedDB) => {
                db = initializedDB;
                console.log('IndexedDB initialized for compression history');
                // 用户统计用 localStorage，确保默认数据
                const stats = getUserStats();
                console.log('Initial stats loaded from localStorage:', stats);
                updateQuotaWarning();
            }).catch(err => {
                console.error('DB init error:', err);
                updateQuotaWarning();
            });

            // 加载偏好设置到UI
            const prefs = loadPreferences();
            document.getElementById('prefSaveHistory').checked = prefs.saveHistory;
            document.getElementById('prefRememberSettings').checked = prefs.rememberSettings;
            document.getElementById('prefAutoDownload').checked = prefs.autoDownload;

            // 加载上次设置
            loadLastSettings();
        });

    </script>

    <!-- 个人中心模态框 -->
    <div class="modal-overlay" id="userCenterModal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>👤 <span data-i18n="personalCenter">个人中心</span></h2>
                <button class="modal-close" onclick="closeUserCenter()">×</button>
            </div>
            <div class="modal-body">
                <div class="user-profile-card" id="profileCard">
                    <!-- 动态填充 -->
                </div>

                <div class="tabs">
                    <div class="tab-item active" data-tab="history" onclick="switchTab('history')" data-i18n="history">压缩历史</div>
                    <div class="tab-item" data-tab="subscription" onclick="switchTab('subscription')" data-i18n="subscription">会员中心</div>
                    <div class="tab-item" data-tab="preferences" onclick="switchTab('preferences')" data-i18n="preferences">偏好设置</div>
                    <div class="tab-item" data-tab="about" onclick="switchTab('about')" data-i18n="about">关于</div>
                </div>

                <div class="tab-content active" id="tab-history">
                    <div class="history-list" id="historyList">
                        <!-- 动态填充 -->
                    </div>
                    <div style="margin-top: 15px; text-align: right;">
                        <button class="btn-zip" onclick="clearAllHistory()" style="background: #6c757d;" data-i18n="clearAllHistory">清空全部历史</button>
                    </div>
                </div>

                <div class="tab-content" id="tab-subscription">
                    <div class="user-profile-card" style="display: block;" id="subscriptionCard">
                        <!-- 动态填充 -->
                    </div>

                    <div style="text-align: center; margin-top: 30px;" id="upgradeBtnContainer">
                        <!-- 动态填充 -->
                    </div>
                </div>

                <div class="tab-content" id="tab-preferences">
                    <div class="preferences-form">
                        <div class="preference-item">
                            <div class="preference-info">
                            <h4 data-i18n="saveHistory">自动保存压缩历史</h4>
                            <p data-i18n="saveHistoryHint">压缩完成后自动保存到历史记录中，数据存在本地</p>
                        </div>
                            <label class="switch">
                                <input type="checkbox" id="prefSaveHistory" checked onchange="savePreferences()">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="preference-item">
                            <div class="preference-info">
                            <h4 data-i18n="rememberSettings">记住上次设置</h4>
                            <p data-i18n="rememberSettingsHint">下次打开页面自动恢复上次的压缩参数</p>
                        </div>
                            <label class="switch">
                                <input type="checkbox" id="prefRememberSettings" checked onchange="savePreferences()">
                                <span class="slider"></span>
                            </label>
                        </div>
                        <div class="preference-item">
                            <div class="preference-info">
                            <h4 data-i18n="autoDownload">自动下载压缩结果</h4>
                            <p data-i18n="autoDownloadHint">压缩完成后自动开始下载</p>
                        </div>
                            <label class="switch">
                                <input type="checkbox" id="prefAutoDownload" onchange="savePreferences()">
                                <span class="slider"></span>
                            </label>
                        </div>
                    </div>

                    <div class="danger-zone">
                        <h4 data-i18n="dangerousOperations">危险操作</h4>
                        <p data-i18n="clearDataDesc">清除所有本地数据包括历史记录、偏好设置和登录信息</p>
                        <button class="btn-clear-data" onclick="clearAllUserData()" data-i18n="clearDataBtn">清除所有本地数据</button>
                    </div>
                </div>

                <div class="tab-content" id="tab-about">
                    <div class="about-section">
                        <h4 data-i18n="aboutTool">关于这个工具</h4>
                        <p data-i18n="aboutDesc">这是一个纯客户端的图片压缩工具，所有压缩操作都在你的浏览器中完成，图片不会上传到服务器，保护你的隐私。</p>
                        
                        <h4 style="margin-top: 20px;" data-i18n="mainFeatures">主要功能</h4>
                        <div class="feature-list">
                            <div class="feature-item" data-i18n="feature1">✓ 指定目标文件大小压缩</div>
                            <div class="feature-item" data-i18n="feature2">✓ 调整图片分辨率</div>
                            <div class="feature-item" data-i18n="feature3">✓ 支持批量压缩</div>
                            <div class="feature-item" data-i18n="feature4">✓ 支持 JPG/PNG/WebP/GIF</div>
                            <div class="feature-item" data-i18n="feature5">✓ 智能二分法迭代压缩</div>
                            <div class="feature-item" data-i18n="feature6">✓ 本地保存压缩历史</div>
                        </div>

                        <p style="margin-top: 20px; font-size: 13px; color: #999;">
                            <span data-i18n="currentVersion">当前版本</span>: v1.0.0<br>
                            <span data-i18n="pureFrontend">纯前端实现，无需后端，数据保存在本地</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- 多国语言支持 -->
    <script>
    // 语言包
    const i18n = {
        'zh-CN': {
            pageTitle: '图片压缩工具 - 指定大小/调整分辨率',
            mainTitle: '图片压缩工具',
            mainSubtitle: '上传图片，可指定目标文件大小 + 调整分辨率，自动压缩满足要求',
            uploadText: '点击或拖拽图片到这里上传',
            uploadHint: '支持 JPG、PNG、GIF、WebP 格式，可一次性上传多张图片\n可同时调整文件大小和分辨率，也可以只调整其中一项',
            targetFileSize: '设置目标文件大小',
            commonPresets: '常用预设',
            customSize: '自定义大小',
            KB: 'KB',
            MB: 'MB',
            enterValue: '输入数值',
            targetResolution: '设置目标分辨率',
            commonPresetsMax: '常用预设（最大边长）',
            keepOriginal: '保持原图',
            pxWithValue: '{{value}}px',
            customMaxWidthLabel: '自定义最大宽度（像素）',
            customMaxWidthPlaceholder: '留空=使用预设',
            resolutionHint: '高度会按比例自动缩放，不填则保持原始分辨率',
            otherSettings: '其他设置',
            outputFormatLabel: '输出格式',
            jpegOption: 'JPEG（推荐，压缩率高）',
            pngOption: 'PNG（保真，压缩率低）',
            webpOption: 'WebP（推荐，兼顾大小和质量）',
            formatHint: '如果需要透明背景，请选择PNG',
            maxIterationsLabel: '最大压缩次数',
            iterationsFast: '5次（快速）',
            iterationsBalanced: '8次（平衡）',
            iterationsPrecise: '12次（精确，慢）',
            iterationsHint: '次数越多越可能达到目标大小，但速度越慢',
            previewComparison: '预览对比',
            originalImage: '原始图片',
            compressedImage: '压缩后图片',
            compressing: '正在压缩...',
            compressionResult: '压缩结果',
            batchStats: '批量处理统计',
            processingList: '处理列表',
            serial: '序号',
            fileName: '文件名',
            originalSize: '原始大小',
            compressedSize: '压缩后',
            status: '状态',
            action: '操作',
            downloadAllZip: '打包全部下载 ZIP',
            startCompression: '开始压缩',
            loginRequired: '需要登录',
            loginPrompt: '这是一个需要登录才能使用的图片压缩工具，请使用 Google 账号登录继续',
            quotaExhausted: '⚠️ 免费额度已用完',
            quotaExhaustedDesc: '您已用完赠送的 30 次免费压缩额度。升级到终身会员即可无限次使用。',
            upgradeNow: '立即升级 - 只需 $9.9',
            personalCenter: '个人中心',
            logout: '退出登录',
            loginPromptOverlay: '请登录后使用',
            totalImages: '已压缩',
            savedSpace: '已节省',
            remainingQuota: '剩余额度',
            unlimited: '无限',
            freeUser: '免费用户',
            proMember: '终身会员',
            upgradeToPro: '升级终身会员',
            lifetimePrice: '$9.9',
            lifetimeAccess: '一次性付费，终身无限使用',
            featuresPro: [
                '无限次图片压缩',
                '优先使用新功能',
                '支持超大图片'
            ],
            history: '压缩历史',
            subscription: '会员中心',
            clearAllHistory: '清空全部历史',
            confirmClearHistory: '确定要清空所有压缩历史吗？',
            quotaExhaustedAlert: '免费额度已用完，请升级会员后继续使用',
            pleaseUploadFirst: '请先上传图片',
            compressionFailed: '压缩失败: ',
            jszipLoadFailed: 'JSZip 加载失败，请检查网络连接后刷新页面重试',
            confirmClearAllData: '确定要清除所有本地数据吗？\n这包括：压缩历史、偏好设置、登录信息\n清除后无法恢复！',
            paymentError: '支付出现错误，请重试。',
            paypalLoadFailed: 'PayPal 加载失败，请检查网络后重试。',
            confirmDeleteRecord: '确定要删除这条记录吗？',
            preferences: '偏好设置',
            about: '关于',
            fileNameCol: '文件名',
            originalSizeCol: '原始大小',
            compressedSizeCol: '压缩后',
            date: '日期',
            actionsCol: '操作',
            download: '下载',
            delete: '删除',
            emptyHistory: '暂无压缩历史记录',
            emptyHistoryHint: '压缩完成后会自动保存到这里',
            saveHistory: '保存压缩历史',
            saveHistoryHint: '在本地 IndexedDB 中保存你的压缩历史记录',
            rememberSettings: '记住上次设置',
            rememberSettingsHint: '下次打开页面自动恢复上次的压缩参数',
            autoDownload: '自动下载压缩结果',
            autoDownloadHint: '压缩完成后自动开始下载',
            dangerousOperations: '危险操作',
            clearAllData: '清除所有本地数据',
            clearDataDesc: '清除所有本地数据包括历史记录、偏好设置和登录信息',
            clearDataBtn: '清除所有本地数据',
            freeTrial: '🎁 免费试用',
            remainingCompressions: '您还剩余 <strong style="color: {{color}}">${remaining}</strong> 次免费压缩机会',
            upgradeToLifetime: '升级终身会员只需',
            proBenefit1: '✓ 终身 <strong>无限次</strong> 使用图片压缩',
            proBenefit2: '✓ 所有现有功能和未来更新',
            proBenefit3: '✓ 一次付费，永久使用',
            proBenefit4: '✓ 支持项目持续开发',
            upgradeNow: '立即升级终身会员',
            aboutTool: '关于这个工具',
            aboutDesc: '这是一个纯客户端的图片压缩工具，所有压缩操作都在你的浏览器中完成，图片不会上传到服务器，保护你的隐私。',
            mainFeatures: '主要功能',
            feature1: '✓ 指定目标文件大小压缩',
            feature2: '✓ 调整图片分辨率',
            feature3: '✓ 支持批量压缩',
            feature4: '✓ 支持 JPG/PNG/WebP/GIF',
            feature5: '✓ 智能二分法迭代压缩',
            feature6: '✓ 本地保存压缩历史',
            currentVersion: '当前版本',
            pureFrontend: '纯前端实现，无需后端，数据保存在本地',
            paymentSuccess: '支付成功',
            paymentSuccessMsg: '恭喜！已成功升级为终身会员，现在可以无限次使用了',
            close: '关闭',
            waiting: '等待处理',
            processing: '处理中',
            done: '已完成',
            error: '失败',
            accessDenied: '🔒 访问受限',
            accessDeniedDesc: '此工具需要在线使用，请访问我们的网站获取完整功能：',
            offlineNotSupported: '下载离线HTML文件无法使用，感谢理解 🙏',
            compressionFailed: '压缩失败',
            reCompress: '重新压缩',
            downloadResult: '下载结果',
            clearAndRecompress: '清空重新压缩',
            original: '原始',
            target: '目标',
            compressed: '压缩后',
            reduced: '减少了',
            resolution: '分辨率',
            keepOriginalResolution: '(原图)'
        },
        'en': {
            pageTitle: 'Image Compressor - Resize to Target Size',
            mainTitle: 'Image Compressor',
            mainSubtitle: 'Upload images, compress to target file size and adjust resolution automatically',
            uploadText: 'Click or drag images here to upload',
            uploadHint: 'Supports JPG, PNG, GIF, WebP, multiple files allowed\nYou can adjust both file size and resolution, or just one of them',
            targetFileSize: 'Target File Size',
            commonPresets: 'Common Presets',
            customSize: 'Custom Size',
            KB: 'KB',
            MB: 'MB',
            enterValue: 'Enter value',
            targetResolution: 'Target Resolution',
            commonPresetsMax: 'Common Presets (Max Width)',
            keepOriginal: 'Original',
            pxWithValue: '{{value}}px',
            customMaxWidthLabel: 'Custom Max Width (px)',
            customMaxWidthPlaceholder: 'Empty = use preset',
            resolutionHint: 'Height will scale automatically, keep original resolution if empty',
            otherSettings: 'Other Settings',
            outputFormatLabel: 'Output Format',
            jpegOption: 'JPEG (Recommended, high compression)',
            pngOption: 'PNG (Lossless, lower compression)',
            webpOption: 'WebP (Recommended, balanced size/quality)',
            formatHint: 'Choose PNG if you need transparent background',
            maxIterationsLabel: 'Max Compression Iterations',
            iterationsFast: '5 (Fast)',
            iterationsBalanced: '8 (Balanced)',
            iterationsPrecise: '12 (Precise, Slow)',
            iterationsHint: 'More iterations = more accurate to target, but slower',
            previewComparison: 'Preview Comparison',
            originalImage: 'Original',
            compressedImage: 'Compressed',
            compressing: 'Compressing...',
            compressionResult: 'Compression Result',
            batchStats: 'Batch Statistics',
            processingList: 'Processing List',
            serial: '#',
            fileName: 'File Name',
            originalSize: 'Original',
            compressedSize: 'Compressed',
            status: 'Status',
            action: 'Action',
            downloadAllZip: 'Download All ZIP',
            startCompression: 'Start Compression',
            loginRequired: 'Login Required',
            loginPrompt: 'You need to login with Google account to use this tool',
            quotaExhausted: '⚠️ Free Quota Exhausted',
            quotaExhaustedDesc: 'You have used all 30 free compressions. Upgrade to lifetime membership for unlimited use.',
            upgradeNow: 'Upgrade Now - $9.9 Only',
            personalCenter: 'User Center',
            logout: 'Logout',
            loginPromptOverlay: 'Please login to continue',
            totalImages: 'Compressed',
            savedSpace: 'Saved',
            remainingQuota: 'Remaining',
            unlimited: 'Unlimited',
            freeUser: 'Free User',
            proMember: 'Lifetime Member',
            upgradeToPro: 'Upgrade to Pro',
            lifetimePrice: '$9.9',
            lifetimeAccess: 'One-time payment, lifetime access',
            featuresPro: [
                'Unlimited image compressions',
                'Priority access to new features',
                'Support for large images'
            ],
            history: 'Compression History',
            subscription: 'Subscription',
            clearAllHistory: 'Clear All History',
            confirmClearHistory: 'Are you sure you want to clear all compression history?',
            quotaExhaustedAlert: 'Free quota exhausted. Please upgrade to Pro to continue.',
            pleaseUploadFirst: 'Please upload images first',
            compressionFailed: 'Compression failed: ',
            jszipLoadFailed: 'JSZip failed to load. Please check network connection and refresh.',
            confirmClearAllData: 'Are you sure you want to clear all local data?\nThis includes: compression history, preferences, login info\nThis cannot be undone!',
            paymentError: 'Payment error, please try again.',
            paypalLoadFailed: 'PayPal failed to load. Please check network connection and try again.',
            confirmDeleteRecord: 'Are you sure you want to delete this record?',
            preferences: 'Preferences',
            about: 'About',
            fileNameCol: 'File',
            originalSizeCol: 'Original',
            compressedSizeCol: 'Compressed',
            date: 'Date',
            actionsCol: 'Actions',
            download: 'Download',
            delete: 'Delete',
            emptyHistory: 'No compression history yet',
            emptyHistoryHint: 'History will be saved here after compression',
            saveHistory: 'Save compression history',
            saveHistoryHint: 'Save compression history to local IndexedDB',
            rememberSettings: 'Remember last settings',
            rememberSettingsHint: 'Auto restore last compression settings on page load',
            autoDownload: 'Auto download results',
            autoDownloadHint: 'Start download automatically after compression completes',
            dangerousOperations: 'Danger Zone',
            clearAllData: 'Clear All Local Data',
            clearDataDesc: 'Clear all local data including history, preferences and login info',
            clearDataBtn: 'Clear All Data',
            freeTrial: '🎁 Free Trial',
            remainingCompressions: 'You have <strong style="color: {{color}}">${remaining}</strong> free compressions remaining',
            upgradeToLifetime: 'Upgrade to Lifetime Membership for only',
            proBenefit1: '✓ <strong>Unlimited</strong> lifetime image compression',
            proBenefit2: '✓ All current features + future updates',
            proBenefit3: '✓ One-time payment, lifetime access',
            proBenefit4: '✓ Support continued development',
            upgradeNow: 'Upgrade Now',
            aboutTool: 'About This Tool',
            aboutDesc: 'This is a pure client-side image compression tool. All compression happens in your browser, images are never uploaded to any server, protecting your privacy.',
            mainFeatures: 'Main Features',
            feature1: '✓ Compress to target file size',
            feature2: '✓ Adjust image resolution',
            feature3: '✓ Support batch compression',
            feature4: '✓ Supports JPG/PNG/WebP/GIF',
            feature5: '✓ Smart binary search compression',
            feature6: '✓ Local history storage',
            currentVersion: 'Version',
            pureFrontend: 'Pure frontend implementation, no backend required, all data stored locally',
            paymentSuccess: 'Payment Successful',
            paymentSuccessMsg: 'Congratulations! You are now a lifetime member, enjoy unlimited compressions',
            close: 'Close',
            waiting: 'Waiting',
            processing: 'Processing',
            done: 'Done',
            error: 'Failed',
            accessDenied: '🔒 Access Restricted',
            accessDeniedDesc: 'This tool requires online access. Please visit our website for full functionality:',
            offlineNotSupported: 'Opening offline HTML file is not supported, thank you for understanding 🙏',
            compressionFailed: 'Compression failed',
            reCompress: 'Compress Again',
            downloadResult: 'Download Result',
            clearAndRecompress: 'Clear & Compress Again',
            original: 'Original',
            target: 'Target',
            compressed: 'Compressed',
            reduced: 'Reduced',
            resolution: 'Resolution',
            keepOriginalResolution: '(original)'
        }
    };

    // 当前语言
    let currentLang = 'zh-CN';

    // 改变语言
    function changeLanguage(lang) {
        currentLang = lang;
        document.documentElement.lang = lang;
        translatePage();
        localStorage.setItem('preferredLanguage', lang);
    }

    // 翻译页面
    function translatePage() {
        // 翻译普通文本元素
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[currentLang][key]) {
                let text = i18n[currentLang][key];
                // 替换参数
                const value = el.getAttribute('data-value');
                if (value) {
                    text = text.replace('{{value}}', value);
                }
                el.textContent = text;
            }
        });

        // 翻译 placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (i18n[currentLang][key]) {
                el.placeholder = i18n[currentLang][key];
            }
        });

        // 翻译 option 元素
        document.querySelectorAll('option[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (i18n[currentLang][key]) {
                el.textContent = i18n[currentLang][key];
            }
        });

        // 更新页面 title
        if (i18n[currentLang].pageTitle) {
            document.title = i18n[currentLang].pageTitle;
        }
    }

    // 页面加载时初始化语言
    document.addEventListener('DOMContentLoaded', function() {
        // 优先从本地存储读取偏好
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang && i18n[savedLang]) {
            currentLang = savedLang;
        } else {
            // 自动检测浏览器语言
            const browserLang = navigator.language || navigator.userLanguage;
            if (browserLang && browserLang.startsWith('en')) {
                currentLang = 'en';
            } else {
                currentLang = 'zh-CN';
            }
        }

        // 设置选择框
        const selector = document.getElementById('langSelector');
        if (selector) {
            selector.value = currentLang;
        }

