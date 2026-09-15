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
  var keys = { left: false, right: false };
  var lastTime = 0;
  var rafId = null;
  var running = false;

  function resetGame() {
    car = {
      x: W / 2,
      y: H * 0.65, // 小车在下方
      animT: 0
    };
    
    // 初始化刮刮卡遮罩（全是草地覆盖）
    scratchCtx.fillStyle = '#4a9c3f';
    scratchCtx.fillRect(0, 0, W, H);
    scratchedPixels = 0;
    updateProgress();
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
      case 'ArrowLeft': case 'a': case 'A': keys.left = true; break;
      case 'ArrowRight': case 'd': case 'D': keys.right = true; break;
    }
  });
  window.addEventListener('keyup', function (e) {
    switch (e.key) {
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
  bindDpadButton(dpad.left, 'left');
  bindDpadButton(dpad.right, 'right');

  // ---------- 更新逻辑 ----------
  function update(dt) {
    var dx = 0;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    var moving = dx !== 0;

    if (moving) {
      car.x += dx * CAR_SPEED * dt;
      var halfW = CAR_W / 2;
      car.x = Math.max(halfW, Math.min(W - halfW, car.x));
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
    // 土地背景 + "生日快乐"大字
    ctx.fillStyle = '#a67c52'; // 浅棕色土地
    ctx.fillRect(0, 0, W, H);
    
    // 绘制"生日快乐"四个大字（深棕色）
    ctx.fillStyle = '#5a3b1f'; // 深棕色
    ctx.font = 'bold ' + Math.floor(W * 0.15) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('生日快乐', W / 2, H * 0.4);
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
    keys.left = keys.right = false;
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
