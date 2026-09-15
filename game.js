// 像素金币小人 - 纯 Canvas 渲染，无外部图片资源依赖
(function () {
  'use strict';

  // ---------- 常量 ----------
  var TILE = 32; // 草地格子像素大小
  var PLAYER_SPEED = 140; // px/s
  var PLAYER_W = 20;
  var PLAYER_H = 26;
  var COIN_R = 8;
  var COIN_TOTAL = 8; // 场上同时存在的金币数量

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
  var coinCountEl = document.getElementById('coin-count');
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
    if (player) {
      player.x = Math.min(player.x, W - PLAYER_W / 2);
      player.y = Math.min(player.y, H - PLAYER_H / 2);
    }
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', function () {
    setTimeout(resizeCanvas, 100);
  });

  // ---------- 玩家状态 ----------
  var player = null; // { x, y, dir, moving, animT }
  var coins = [];
  var coinScore = 0;
  var keys = { up: false, down: false, left: false, right: false };
  var lastTime = 0;
  var rafId = null;
  var running = false;

  function resetGame() {
    coinScore = 0;
    coinCountEl.textContent = '0';
    player = {
      x: W / 2,
      y: H / 2,
      dir: 'down',
      moving: false,
      animT: 0
    };
    coins = [];
    for (var i = 0; i < COIN_TOTAL; i++) {
      coins.push(spawnCoin());
    }
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnCoin() {
    var margin = 30;
    var topSafe = 70; // 避开顶部 HUD
    var bottomSafe = 190; // 避开底部方向键
    return {
      x: randRange(margin, Math.max(margin + 1, W - margin)),
      y: randRange(topSafe, Math.max(topSafe + 1, H - bottomSafe)),
      collected: false,
      bob: Math.random() * Math.PI * 2
    };
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
    player.moving = moving;

    if (moving) {
      var len = Math.sqrt(dx * dx + dy * dy);
      dx /= len; dy /= len;

      if (Math.abs(dx) > Math.abs(dy)) {
        player.dir = dx > 0 ? 'right' : 'left';
      } else {
        player.dir = dy > 0 ? 'down' : 'up';
      }

      player.x += dx * PLAYER_SPEED * dt;
      player.y += dy * PLAYER_SPEED * dt;

      var halfW = PLAYER_W / 2, halfH = PLAYER_H / 2;
      player.x = Math.max(halfW, Math.min(W - halfW, player.x));
      player.y = Math.max(70 + halfH, Math.min(H - halfH - 20, player.y));

      player.animT += dt;
    } else {
      player.animT = 0;
    }

    // 碰撞检测：金币
    for (var i = 0; i < coins.length; i++) {
      var c = coins[i];
      if (c.collected) continue;
      var ddx = c.x - player.x;
      var ddy = c.y - (player.y - 4);
      var dist = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dist < COIN_R + Math.min(PLAYER_W, PLAYER_H) / 2) {
        c.collected = true;
        coinScore++;
        coinCountEl.textContent = String(coinScore);
        // 稍后在原地重新生成一个新金币，保持场上数量恒定
        setTimeout(function (idx) {
          return function () {
            coins[idx] = spawnCoin();
          };
        }(i), 260);
      }
    }
  }

  // ---------- 渲染 ----------
  function drawBackground() {
    // 草地棋盘格纹理，两种绿色交替 + 细小装饰点，营造星露谷式草坪质感
    var cols = Math.ceil(W / TILE) + 1;
    var rows = Math.ceil(H / TILE) + 1;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var even = (r + c) % 2 === 0;
        ctx.fillStyle = even ? '#4a9c3f' : '#458f3a';
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    // 随机分布的小草点缀（固定种子感：用坐标算简单哈希，避免每帧闪烁）
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        var h = (r2 * 928371 + c2 * 12345) % 7;
        if (h === 0) {
          ctx.fillRect(c2 * TILE + 6, r2 * TILE + 22, 3, 6);
          ctx.fillRect(c2 * TILE + 14, r2 * TILE + 18, 3, 8);
        }
      }
    }
  }

  function drawCoin(c) {
    if (c.collected) return;
    var bobOffset = Math.sin(performance.now() / 220 + c.bob) * 2;
    var y = c.y + bobOffset;
    ctx.save();
    ctx.translate(c.x, y);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, COIN_R + 4, COIN_R * 0.8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // 金币主体
    var grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, COIN_R);
    grad.addColorStop(0, '#fff3c0');
    grad.addColorStop(0.5, '#ffcf3f');
    grad.addColorStop(1, '#c9861a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, COIN_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#6b4a1f';
    ctx.stroke();
    // 内部符号
    ctx.fillStyle = '#a9700f';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0.5);
    ctx.restore();
  }

  // 简单像素小人：方块头身 + 四方向朝向 + 走动摆腿动画
  function drawPlayer() {
    var p = player;
    var bobStep = p.moving ? (Math.floor(p.animT * 6) % 2 === 0 ? 1 : -1) : 0;
    ctx.save();
    ctx.translate(p.x, p.y);

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, PLAYER_H / 2 + 2, PLAYER_W / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    var bodyColor = '#3a6fb0';
    var skinColor = '#f2c48c';
    var hairColor = '#5a3b1f';

    // 身体（躯干）
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-PLAYER_W / 2, -2, PLAYER_W, PLAYER_H / 2 + 2);

    // 腿部（走动时左右交替偏移，模拟步伐）
    ctx.fillStyle = '#2e4d7a';
    ctx.fillRect(-PLAYER_W / 2 + 2 + bobStep, PLAYER_H / 2 - 2, 6, 6);
    ctx.fillRect(PLAYER_W / 2 - 8 - bobStep, PLAYER_H / 2 - 2, 6, 6);

    // 头部
    ctx.fillStyle = skinColor;
    ctx.fillRect(-PLAYER_W / 2 + 2, -PLAYER_H / 2, PLAYER_W - 4, PLAYER_H / 2 + 2);

    // 头发（根据朝向调整位置，营造转向感）
    ctx.fillStyle = hairColor;
    ctx.fillRect(-PLAYER_W / 2 + 1, -PLAYER_H / 2 - 3, PLAYER_W - 2, 5);

    // 眼睛：根据方向绘制在不同侧，模拟人物转身
    ctx.fillStyle = '#2b1d0e';
    if (p.dir === 'left') {
      ctx.fillRect(-PLAYER_W / 2 + 4, -PLAYER_H / 2 + 6, 3, 3);
    } else if (p.dir === 'right') {
      ctx.fillRect(PLAYER_W / 2 - 7, -PLAYER_H / 2 + 6, 3, 3);
    } else if (p.dir === 'up') {
      // 背面：不画眼睛，画一点头发覆盖
      ctx.fillStyle = hairColor;
      ctx.fillRect(-PLAYER_W / 2 + 2, -PLAYER_H / 2, PLAYER_W - 4, 8);
    } else {
      // down：正面，两只眼睛
      ctx.fillRect(-PLAYER_W / 2 + 4, -PLAYER_H / 2 + 6, 3, 3);
      ctx.fillRect(PLAYER_W / 2 - 7, -PLAYER_H / 2 + 6, 3, 3);
    }

    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    coins.forEach(drawCoin);
    if (player) drawPlayer();
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
