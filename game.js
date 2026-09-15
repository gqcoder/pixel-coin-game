// 生日刮刮卡游戏 - 像素风
(function () {
  'use strict';

  // ---------- 常量 ----------
  var TILE = 32; // 草地格子像素大小
  var CAR_SPEED = 200; // px/s（稍微加速）
  var CAR_W = 56; // 小车宽度（稍微加宽）
  var CAR_H = 44; // 小车高度
  var SCRATCH_SIZE = 36; // 刮开区域大小

  // ---------- DOM ----------
  var screens = {
    menu: document.getElementById('menu-screen'),
    exit: document.getElementById('exit-screen'),
    game: document.getElementById('game-screen')
  };
  var btnStart = document.getElementById('btn-start');
  var btnExit = document.getElementById('btn-exit');
  var btnBackToMenu = document.getElementById('btn-back-to-menu');
  var btnQuit = document.getElementById('btn-quit');
  var canvas = document.getElementById('game-canvas');
  var ctx = canvas.getContext('2d');
  var scratchCanvas = document.createElement('canvas'); // 刮开的遮罩层
  var scratchCtx = scratchCanvas.getContext('2d');
  var progressEl = document.getElementById('scratch-progress');
  var dpad = {
    up: document.getElementById('dpad-up'),
    down: document.getElementById('dpad-down'),
    left: document.getElementById('dpad-left'),
    right: document.getElementById('dpad-right')
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
  }

  // ---------- 画布尺寸自适应（支持高分屏 + 横竖屏） ----------
  var W = 0, H = 0;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false;
    
    // 刮刮卡遮罩层
    scratchCanvas.width = Math.floor(W * DPR);
    scratchCanvas.height = Math.floor(H * DPR);
    scratchCtx.setTransform(DPR, 0, 0, DPR, 0, 0);
    scratchCtx.imageSmoothingEnabled = false;
    
    if (car) {
      car.x = Math.min(car.x, W - CAR_W / 2);
    }
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', function () {
    setTimeout(resizeCanvas, 100);
  });

  // ---------- 游戏状态 ----------
  var car = null; // { x, y, animT }
  var scratchedPixels = 0; // 已刮开的像素数
  var keys = { up: false, down: false, left: false, right: false };
  var lastTime = 0;
  var rafId = null;
  var running = false;
  var picImage = null; // 加载的图片

  function resetGame() {
    car = {
      x: W / 2,
      y: H / 2,
      animT: 0
    };
    
    // 初始化刮刮卡遮罩（星露谷风格草地）
    drawGrassOverlay();
    scratchedPixels = 0;
    updateProgress();
  }
  
  // 绘制星露谷风格草地遮罩：多层绿色块 + 草丛纹理 + 小花点缀
  function drawGrassOverlay() {
    var cols = Math.ceil(W / TILE) + 1;
    var rows = Math.ceil(H / TILE) + 1;
    
    // 底色：4 种深浅不同的绿色随机拼接
    var greens = ['#4a9c3f', '#458f3a', '#5cae4c', '#3f8636'];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // 用位运算制造伪随机颜色选择
        var seed = (r * 73856093) ^ (c * 19349663);
        var colorIdx = Math.abs(seed) % 4;
        scratchCtx.fillStyle = greens[colorIdx];
        scratchCtx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }

    // 深色草丛纹理（模拟草叶簇）
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var seed2 = (r2 * 83492791) ^ (c2 * 49979687);
        var h2 = Math.abs(seed2) % 5;
        var px = c2 * TILE, py = r2 * TILE;
        if (h2 === 0) {
          scratchCtx.fillStyle = 'rgba(30,70,25,0.35)';
          scratchCtx.fillRect(px + 5, py + 20, 4, 8);
          scratchCtx.fillRect(px + 12, py + 16, 4, 10);
          scratchCtx.fillRect(px + 20, py + 22, 4, 6);
        } else if (h2 === 1) {
          scratchCtx.fillStyle = 'rgba(255,255,255,0.12)';
          scratchCtx.fillRect(px + 8, py + 8, 3, 5);
          scratchCtx.fillRect(px + 18, py + 12, 3, 5);
        }
      }
    }

    // 小花点缀（黄色/白色小花，增加生动感）
    for (var r3 = 0; r3 < rows; r3++) {
      for (var c3 = 0; c3 < cols; c3++) {
        var seed3 = (r3 * 73856093) ^ (c3 * 83492791);
        var h3 = Math.abs(seed3) % 17;
        if (h3 === 0) {
          var fx = c3 * TILE + 16, fy = r3 * TILE + 16;
          scratchCtx.fillStyle = '#fff6c9';
          scratchCtx.beginPath();
          scratchCtx.arc(fx, fy, 2.5, 0, Math.PI * 2);
          scratchCtx.fill();
          scratchCtx.fillStyle = '#f2a33c';
          scratchCtx.beginPath();
          scratchCtx.arc(fx, fy, 1, 0, Math.PI * 2);
          scratchCtx.fill();
        } else if (h3 === 5) {
          var fx2 = c3 * TILE + 10, fy2 = r3 * TILE + 24;
          scratchCtx.fillStyle = '#ffffff';
          scratchCtx.beginPath();
          scratchCtx.arc(fx2, fy2, 2, 0, Math.PI * 2);
          scratchCtx.fill();
        }
      }
    }
  }

  function updateProgress() {
    var totalPixels = W * H;
    var progress = Math.round((scratchedPixels / totalPixels) * 100);
    if (progressEl) {
      progressEl.textContent = progress + '%';
    }
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  // ---------- 输入：键盘 ----------
  window.addEventListener('keydown', function (e) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': keys.up = true; break;
      case 'ArrowDown': case 's': case 'S': keys.down = true; break;
      case 'ArrowLeft': case 'a': case 'A': keys.left = true; break;
      case 'ArrowRight': case 'd': case 'D': keys.right = true; break;
    }
  });
  window.addEventListener('keyup', function (e) {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': keys.up = false; break;
      case 'ArrowDown': case 's': case 'S': keys.down = false; break;
      case 'ArrowLeft': case 'a': case 'A': keys.left = false; break;
      case 'ArrowRight': case 'd': case 'D': keys.right = false; break;
    }
  });

  // ---------- 输入：虚拟方向键（触屏 + 鼠标兼容） ----------
  function bindDpadButton(el, key) {
    if (!el) return;
    var press = function (e) {
      e.preventDefault();
      keys[key] = true;
      el.classList.add('active');
    };
    var release = function (e) {
      if (e) e.preventDefault();
      keys[key] = false;
      el.classList.remove('active');
    };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', release);
  }
  bindDpadButton(dpad.up, 'up');
  bindDpadButton(dpad.down, 'down');
  bindDpadButton(dpad.left, 'left');
  bindDpadButton(dpad.right, 'right');

  // ---------- 更新逻辑 ----------
  function update(dt) {
    var dx = 0, dy = 0;
    if (keys.up) dy -= 1;
    if (keys.down) dy += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    var moving = dx !== 0 || dy !== 0;

    if (moving) {
      var len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;
      
      car.x += dx * CAR_SPEED * dt;
      car.y += dy * CAR_SPEED * dt;
      
      var halfW = CAR_W / 2, halfH = CAR_H / 2;
      car.x = Math.max(halfW, Math.min(W - halfW, car.x));
      car.y = Math.max(halfH + 10, Math.min(H - halfH - 10, car.y));
      car.animT += dt;
    } else {
      car.animT = 0;
    }

    // 刮开小车经过的区域
    if (moving) {
      scratchArea(car.x, car.y);
    }
  }

  // 刮开指定区域
  function scratchArea(x, y) {
    scratchCtx.save();
    scratchCtx.globalCompositeOperation = 'destination-out';
    scratchCtx.fillStyle = 'rgba(0,0,0,1)';
    scratchCtx.beginPath();
    scratchCtx.arc(x, y, SCRATCH_SIZE, 0, Math.PI * 2);
    scratchCtx.fill();
    scratchCtx.restore();
    
    // 简单估算刮开的像素（实际应该用getImageData，但为了性能简化）
    scratchedPixels += Math.PI * SCRATCH_SIZE * SCRATCH_SIZE * 0.3;
    if (scratchedPixels > W * H) scratchedPixels = W * H;
    updateProgress();
  }

  // ---------- 渲染 ----------
  function drawBackground() {
    // 浅棕色土地背景
    ctx.fillStyle = '#c4a57b'; // 更浅的棕色土地
    ctx.fillRect(0, 0, W, H);
    
    // 上方：相框 + 图片（增大比例）
    var frameW = Math.min(W * 0.75, H * 0.48); // 相框宽度增大
    var frameH = frameW * 0.75; // 相框高度（4:3 比例）
    var frameX = (W - frameW) / 2; // 居中
    var frameY = H * 0.05; // 距离顶部 5%
    
    if (picImage && picImage.complete) {
      // 相框外框（深棕色木纹效果）
      var frameBorder = 12;
      ctx.fillStyle = '#4a2f1a'; // 深棕色木纹
      ctx.fillRect(frameX - frameBorder, frameY - frameBorder, 
                   frameW + frameBorder * 2, frameH + frameBorder * 2);
      
      // 相框内框（浅金色装饰边）
      var innerBorder = 6;
      ctx.fillStyle = '#d4af37'; // 金色
      ctx.fillRect(frameX - innerBorder, frameY - innerBorder, 
                   frameW + innerBorder * 2, frameH + innerBorder * 2);
      
      // 图片区域（白色背景）
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(frameX, frameY, frameW, frameH);
      
      // 绘制图片（等比缩放填充相框）
      var imgRatio = picImage.width / picImage.height;
      var frameRatio = frameW / frameH;
      var drawW, drawH, drawX, drawY;
      
      if (imgRatio > frameRatio) {
        // 图片更宽，以高度为准
        drawH = frameH;
        drawW = drawH * imgRatio;
        drawX = frameX - (drawW - frameW) / 2;
        drawY = frameY;
      } else {
        // 图片更高，以宽度为准
        drawW = frameW;
        drawH = drawW / imgRatio;
        drawX = frameX;
        drawY = frameY - (drawH - frameH) / 2;
      }
      
      ctx.save();
      ctx.beginPath();
      ctx.rect(frameX, frameY, frameW, frameH);
      ctx.clip();
      ctx.drawImage(picImage, drawX, drawY, drawW, drawH);
      ctx.restore();
    }
    
    // 计算气泡起始位置（紧贴相框下方，只留20px间距）
    var frameBottom = frameY + frameH + 24; // 相框底部 + 边框
    var bubbleY = frameBottom + 20; // 间距缩小到 20px
    var bubbleH = H - bubbleY - H * 0.05; // 气泡高度（到屏幕底部留5%边距）
    
    // 绘制浅色气泡背景（圆润的米色背景）
    ctx.fillStyle = '#fff5e6'; // 浅米色
    ctx.beginPath();
    ctx.roundRect(W * 0.08, bubbleY, W * 0.84, bubbleH, 20);
    ctx.fill();
    
    // 气泡边框（浅粉色）
    ctx.strokeStyle = '#ffb7c5'; // 粉色边框
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // 气泡小三角（指向相框方向）
    ctx.fillStyle = '#fff5e6';
    ctx.beginPath();
    ctx.moveTo(W / 2 - 15, bubbleY);
    ctx.lineTo(W / 2 + 15, bubbleY);
    ctx.lineTo(W / 2, bubbleY - 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffb7c5';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // 绘制可爱的装饰元素（气球，缩小）
    var decorSize = Math.floor(Math.min(W * 0.04, 16));
    ctx.font = decorSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎈', W * 0.14, bubbleY + bubbleH * 0.3); // 左侧气球
    ctx.fillText('🎈', W * 0.86, bubbleY + bubbleH * 0.3); // 右侧气球
    
    // 绘制"生日快乐"两行大字（完全居中对齐，缩小比例）
    var fontSize = Math.floor(Math.min(W * 0.11, H * 0.06));
    
    // 第一行：生日
    ctx.fillStyle = '#ff6b9d'; // 可爱粉色
    ctx.font = 'bold ' + fontSize + 'px "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('生日', W / 2, bubbleY + bubbleH * 0.32);
    
    // 第二行：快乐
    ctx.fillStyle = '#ff4757'; // 红色喜庆
    ctx.font = 'bold ' + fontSize + 'px "Arial Rounded MT Bold", "Helvetica Rounded", Arial, sans-serif';
    ctx.fillText('快乐', W / 2, bubbleY + bubbleH * 0.56);
    
    // 蛋糕 emoji（单独居中放在最下方，缩小）
    ctx.font = (fontSize * 0.9) + 'px sans-serif';
    ctx.fillText('🎂', W / 2, bubbleY + bubbleH * 0.80);
  }

  function drawCar() {
    var c = car;
    var wheelBob = c.animT > 0 ? Math.sin(c.animT * 12) * 3 : 0;
    
    ctx.save();
    ctx.translate(c.x, c.y);

    // 车体阴影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, CAR_H / 2 + 6, CAR_W / 2 + 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // === 可爱像素风小车（参考星露谷风格） ===
    
    // 车身底部（深蓝色底座）
    ctx.fillStyle = '#2e5a88';
    ctx.fillRect(-CAR_W / 2, 4, CAR_W, 16);
    
    // 车身主体（天蓝色）
    ctx.fillStyle = '#5b9bd5';
    ctx.fillRect(-CAR_W / 2 + 4, -CAR_H / 2 + 8, CAR_W - 8, CAR_H / 2 + 2);
    
    // 车身顶部（浅蓝色渐变）
    ctx.fillStyle = '#89c4f4';
    ctx.fillRect(-CAR_W / 2 + 6, -CAR_H / 2 + 6, CAR_W - 12, 8);
    
    // 车顶（深蓝色顶棚）
    ctx.fillStyle = '#3d7ab8';
    ctx.fillRect(-CAR_W / 2 + 8, -CAR_H / 2, CAR_W - 16, 8);
    
    // 车门（两侧）
    ctx.fillStyle = '#4a8bc7';
    ctx.fillRect(-CAR_W / 2 + 8, -CAR_H / 2 + 10, CAR_W / 3, 14);
    ctx.fillRect(CAR_W / 2 - 8 - CAR_W / 3, -CAR_H / 2 + 10, CAR_W / 3, 14);
    
    // 车窗（浅蓝色玻璃）
    ctx.fillStyle = '#b8e0ff';
    ctx.fillRect(-CAR_W / 2 + 10, -CAR_H / 2 + 12, CAR_W / 3 - 4, 10);
    ctx.fillRect(CAR_W / 2 - 6 - CAR_W / 3, -CAR_H / 2 + 12, CAR_W / 3 - 4, 10);
    
    // 车窗高光
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-CAR_W / 2 + 11, -CAR_H / 2 + 13, 4, 3);
    ctx.fillRect(CAR_W / 2 - 5 - CAR_W / 3, -CAR_H / 2 + 13, 4, 3);
    
    // 车灯（黄色）
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(-CAR_W / 2 + 2, -CAR_H / 2 + 14, 4, 6);
    ctx.fillRect(CAR_W / 2 - 6, -CAR_H / 2 + 14, 4, 6);
    
    // 车灯高光
    ctx.fillStyle = '#fff8dc';
    ctx.fillRect(-CAR_W / 2 + 2, -CAR_H / 2 + 14, 2, 2);
    ctx.fillRect(CAR_W / 2 - 6, -CAR_H / 2 + 14, 2, 2);
    
    // 前进挡风玻璃（蓝色玻璃效果）
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(-CAR_W / 2 + 10, -CAR_H / 2 + 2, CAR_W - 20, 6);
    ctx.fillStyle = '#b8e0ff';
    ctx.fillRect(-CAR_W / 2 + 12, -CAR_H / 2 + 3, CAR_W - 24, 2);
    
    // === 车轮（更大更可爱） ===
    var wheelR = 10;
    var wheelY = CAR_H / 2 + 4;
    
    // 左轮
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 14, wheelY + wheelBob, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 14, wheelY + wheelBob, wheelR - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 14, wheelY + wheelBob, wheelR - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 14, wheelY + wheelBob, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // 右轮
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 14, wheelY - wheelBob, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 14, wheelY - wheelBob, wheelR - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 14, wheelY - wheelBob, wheelR - 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 14, wheelY - wheelBob, 2, 0, Math.PI * 2);
    ctx.fill();
    
    // === 车上可爱小人 ===
    var skinColor = '#ffd5b8';
    var hairColor = '#8b4513';
    var bodyColor = '#ff6b9d'; // 粉色上衣
    var shortsColor = '#5b9bd5'; // 蓝色短裤
    
    // 头部
    ctx.fillStyle = skinColor;
    ctx.fillRect(-8, -CAR_H / 2 - 20, 16, 14);
    
    // 头发（可爱刘海）
    ctx.fillStyle = hairColor;
    ctx.fillRect(-8, -CAR_H / 2 - 24, 16, 6);
    ctx.fillRect(-10, -CAR_H / 2 - 20, 4, 8); // 左边刘海
    ctx.fillRect(6, -CAR_H / 2 - 20, 4, 8); // 右边刘海
    
    // 眼睛（可爱圆眼）
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-4, -CAR_H / 2 - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4, -CAR_H / 2 - 14, 2.5, 0, Math.PI * 2);
    ctx.fill();
    
    // 眼睛高光
    ctx.fillStyle = '#fff';
    ctx.fillRect(-5, -CAR_H / 2 - 15, 1.5, 1.5);
    ctx.fillRect(3, -CAR_H / 2 - 15, 1.5, 1.5);
    
    // 腮红（可爱）
    ctx.fillStyle = 'rgba(255,150,150,0.4)';
    ctx.fillRect(-7, -CAR_H / 2 - 11, 3, 2);
    ctx.fillRect(4, -CAR_H / 2 - 11, 3, 2);
    
    // 嘴巴（微笑）
    ctx.fillStyle = '#e57373';
    ctx.fillRect(-3, -CAR_H / 2 - 9, 6, 2);
    
    // 身体（粉色上衣）
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-10, -CAR_H / 2 - 6, 20, 12);
    
    // 短裤
    ctx.fillStyle = shortsColor;
    ctx.fillRect(-10, -CAR_H / 2 + 4, 20, 6);
    
    // 手臂
    ctx.fillStyle = skinColor;
    ctx.fillRect(-14, -CAR_H / 2 - 4, 4, 8);
    ctx.fillRect(10, -CAR_H / 2 - 4, 4, 8);
    
    // 举起的手（小手）
    ctx.fillStyle = skinColor;
    ctx.fillRect(-14, -CAR_H / 2 - 8, 4, 4);
    ctx.fillRect(10, -CAR_H / 2 - 8, 4, 4);
    
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    
    // 绘制草地遮罩层（刮刮卡效果）
    ctx.drawImage(scratchCanvas, 0, 0, W, H);
    
    if (car) drawCar();
  }

  // ---------- 主循环 ----------
  function loop(ts) {
    if (!running) return;
    if (!lastTime) lastTime = ts;
    var dt = Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    update(dt);
    render();
    rafId = requestAnimationFrame(loop);
  }

  function startGame() {
    showScreen('game');
    resizeCanvas();
    resetGame();
    running = true;
    lastTime = 0;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function stopGame() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    keys.up = keys.down = keys.left = keys.right = false;
  }

  // ---------- 按钮事件 ----------
  btnStart.addEventListener('click', startGame);
  btnExit.addEventListener('click', function () {
    stopGame();
    showScreen('exit');
  });
  btnBackToMenu.addEventListener('click', function () {
    showScreen('menu');
  });
  btnQuit.addEventListener('click', function () {
    stopGame();
    showScreen('menu');
  });

  // ---------- 初始化 ----------
  resizeCanvas();
  showScreen('menu');
  
  // 加载图片
  picImage = new Image();
  picImage.src = 'pics/hbd_pics.jpg';
  picImage.onerror = function() {
    console.warn('图片加载失败，将不显示相框');
  };

  // ---------- 注册 Service Worker（PWA 离线支持） ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service Worker 注册失败:', err);
      });
    });
  }
})();
