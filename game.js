// 生日刮刮卡游戏 - 像素风
(function () {
  'use strict';

  // ---------- 常量 ----------
  var TILE = 32; // 草地格子像素大小
  var CAR_SPEED = 180; // px/s
  var CAR_W = 48; // 小车宽度
  var CAR_H = 40; // 小车高度
  var SCRATCH_SIZE = 32; // 刮开区域大小

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
    
    // 绘制"生日快乐"两行大字（深棕色）
    ctx.fillStyle = '#5a3b1f'; // 深棕色
    var fontSize = Math.floor(Math.min(W * 0.22, H * 0.15));
    ctx.font = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // 第一行：生日
    ctx.fillText('生日', W / 2, H * 0.42);
    // 第二行：快乐！
    ctx.fillText('快乐！', W / 2, H * 0.58);
  }

  function drawCar() {
    var c = car;
    var wheelBob = c.animT > 0 ? Math.sin(c.animT * 12) * 2 : 0;
    
    ctx.save();
    ctx.translate(c.x, c.y);

    // 车体阴影
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, CAR_H / 2 + 4, CAR_W / 2 + 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // 车体（像素风小车）
    ctx.fillStyle = '#d84315'; // 红色车身
    ctx.fillRect(-CAR_W / 2, -CAR_H / 2 + 10, CAR_W, CAR_H / 2 + 5);
    
    // 车顶
    ctx.fillStyle = '#bf360c';
    ctx.fillRect(-CAR_W / 2 + 8, -CAR_H / 2, CAR_W - 16, 12);
    
    // 车窗
    ctx.fillStyle = '#80d8ff';
    ctx.fillRect(-CAR_W / 2 + 12, -CAR_H / 2 + 2, 12, 8);
    ctx.fillRect(CAR_W / 2 - 24, -CAR_H / 2 + 2, 12, 8);
    
    // 车轮
    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 12, CAR_H / 2 + 8 + wheelBob, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 12, CAR_H / 2 + 8 - wheelBob, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // 车轮轮毂
    ctx.fillStyle = '#757575';
    ctx.beginPath();
    ctx.arc(-CAR_W / 2 + 12, CAR_H / 2 + 8 + wheelBob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(CAR_W / 2 - 12, CAR_H / 2 + 8 - wheelBob, 3, 0, Math.PI * 2);
    ctx.fill();
    
    // 小人（坐在车上）
    var skinColor = '#f2c48c';
    var hairColor = '#5a3b1f';
    var bodyColor = '#3a6fb0';
    
    // 头部
    ctx.fillStyle = skinColor;
    ctx.fillRect(-6, -CAR_H / 2 - 14, 12, 12);
    
    // 头发
    ctx.fillStyle = hairColor;
    ctx.fillRect(-6, -CAR_H / 2 - 16, 12, 4);
    
    // 眼睛
    ctx.fillStyle = '#2b1d0e';
    ctx.fillRect(-4, -CAR_H / 2 - 10, 2, 2);
    ctx.fillRect(2, -CAR_H / 2 - 10, 2, 2);
    
    // 身体
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-8, -CAR_H / 2 - 2, 16, 12);
    
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

  // ---------- 注册 Service Worker（PWA 离线支持） ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Service Worker 注册失败:', err);
      });
    });
  }
})();
