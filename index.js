var CIRCLE = Math.PI * 2;
var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent)


function Controls() {
  this.codes  = { 65: 'left', 68: 'right', 37: 'turnleft', 39: 'turnright', 87: 'forward', 83: 'backward' };
  this.states = { 'left': false, 'right': false, 'turnleft': false, 'turnright': false, 'forward': false, 'backward': false };
  document.addEventListener('keydown', this.onKey.bind(this, true), false);
  document.addEventListener('keyup', this.onKey.bind(this, false), false);
  document.addEventListener('touchstart', this.onTouch.bind(this), false);
  document.addEventListener('touchmove', this.onTouch.bind(this), false);
  document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
}

Controls.prototype.onTouch = function(e) {
  var t = e.touches[0];
  this.onTouchEnd(e);
  if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
  else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
  else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
};

Controls.prototype.onTouchEnd = function(e) {
  this.states = { 'left': false, 'right': false, 'left': false, 'right': false, 'forward': false, 'backward': false };
  e.preventDefault();
  e.stopPropagation();
};

Controls.prototype.onKey = function(val, e) {
  var state = this.codes[e.keyCode];
  if (typeof state === 'undefined') return;
  this.states[state] = val;
  e.preventDefault && e.preventDefault();
  e.stopPropagation && e.stopPropagation();
};


function Bitmap(src, width, height) {
  this.image = new Image();
  this.image.src = src;
  this.width = width;
  this.height = height;
}


function Player(x, y, direction) {
  this.x = x;
  this.y = y;
  this.direction = direction;
  this.weapon = new Bitmap('assets/knife_hand.png', 319, 320);
  this.paces = 0;
  this.id = Math.random().toString().replace(/\./g, '');
}

Player.prototype.rotate = function(angle) {
  this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
};

Player.prototype.walk = function(distance, angle, map) {
  var dx = Math.cos(this.direction+angle) * distance;
  var dy = Math.sin(this.direction+angle) * distance;
  if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
  if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
  this.paces += distance;
};

Player.prototype.update = function(controls, map, seconds) {
  var size = 0, key;
  for (key in controls) {
      if (['left','right','forward','backward'].indexOf(key) > -1 && controls[key]) size++;
  }
  var speed = size > 1 ? 1.5 : 3;
  if (controls.turnleft) this.rotate(-2.8 * seconds);
  if (controls.turnright) this.rotate(2.8 * seconds);
  if (controls.left) this.walk(speed * seconds, -90, map);
  if (controls.right) this.walk(-speed * seconds, -90, map);
  if (controls.forward) this.walk(speed * seconds, 0, map);
  if (controls.backward) this.walk(-speed * seconds, 0, map);
};


function Map(map, mapSize) {
  this.size = mapSize;
  this.wallGrid = map;
  this.skybox = new Bitmap('assets/deathvalley_panorama.png', 2000, 750);
  this.wallTexture = new Bitmap('assets/wall_texture.jpg', 64, 64);
  this.floorTexture = new Bitmap('assets/floor_texture.jpg', 64, 64);
  this.shadowTexture = new Bitmap('assets/shadow.png', 171, 64);
  this.light = 0;
}

Map.prototype.get = function(x, y) {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
  return this.wallGrid[y * this.size + x];
};

Map.prototype.cast = function(point, angle, range) {
  var self = this;
  var sin = Math.sin(angle);
  var cos = Math.cos(angle);
  var noWall = { length2: Infinity };

  return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

  function ray(origin) {
    var stepX = step(sin, cos, origin.x, origin.y);
    var stepY = step(cos, sin, origin.y, origin.x, true);
    var nextStep = stepX.length2 < stepY.length2
      ? inspect(stepX, 1, 0, origin.distance, stepX.y)
      : inspect(stepY, 0, 1, origin.distance, stepY.x);

    if (nextStep.distance > range) return [origin];
    return [origin].concat(ray(nextStep));
  }

  function step(rise, run, x, y, inverted) {
    if (run === 0) return noWall;
    var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
    var dy = dx * (rise / run);
    return {
      x: inverted ? y + dy : x + dx,
      y: inverted ? x + dx : y + dy,
      length2: dx * dx + dy * dy 
    };
  }

  function inspect(step, shiftX, shiftY, distance, offset) {
    var dx = cos < 0 ? shiftX : 0;
    var dy = sin < 0 ? shiftY : 0;
    step.height = self.get(step.x - dx, step.y - dy);
    step.distance = distance + Math.sqrt(step.length2);
    if (shiftX) step.shading = cos < 0 ? 2 : 0;
    else step.shading = sin < 0 ? 2 : 1;
    step.offset = offset - Math.floor(offset);
    step.dx = dx;
    step.dy = dy;
    step.shiftX = shiftX;
    step.shiftY = shiftY;
    return step;
  }
};

Map.prototype.update = function(seconds) {
  // if (this.light > 0) this.light = Math.max(this.light - 10 * seconds, 0);
  // else if (Math.random() * 5 < seconds) this.light = 2;
};


function Camera(canvas, minimap, resolution, focalLength) {
  this.ctx = canvas.getContext('2d');
  this.minimap = minimap.getContext('2d');
  this.width = canvas.width = window.innerWidth * 0.5;
  this.height = canvas.height = window.innerHeight * 0.5;
  this.resolution = resolution;
  this.spacing = this.width / resolution;
  this.focalLength = focalLength || 0.8;
  this.range = 32;
  this.lightRange = 12;
  this.scale = (this.width + this.height) / 1200;
}

Camera.prototype.loadTextures = function(map) {
  var ctx = this.ctx;
  var floor = map.floorTexture;
  var $ = this;

  floor.image.onload = function() {
    ctx.drawImage(floor.image, 0, 0);
    
    var imageData = ctx.getImageData(0, 0, floor.width, floor.height);
    $.floorData = imageData.data;
  }
};

Camera.prototype.render = function(player, map, data) {
  this.drawSky(player.direction, map.skybox);
  this.drawMinimap(player, map, 192, data);
  this.drawColumns(player, map);
  this.drawTarget();
};

Camera.prototype.drawMinimap = function(player, map, size, data) {
  var ctx = this.minimap;
  var sz = size / map.size;
  var players = data.players;
  ctx.clearRect(0, 0, size, size);
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  for (var x = 0; x < map.size; x++) {
    for (var y = 0; y < map.size; y++) {
      if (map.get(x, y) === 1) {
        ctx.fillStyle = '#999';
        ctx.fillRect(x * sz, y * sz, sz, sz);
      }
    }
  }
  ctx.fillStyle = '#F00';
  for (var i = 0; i < players.length; i++) {
    ctx.beginPath();
    ctx.arc(player[i].x * sz, player[i].y * sz, 3.5, 0, Math.PI*2, false);
    ctx.fill();
  }
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(player.x * sz, player.y * sz, 3.5, 0, Math.PI*2, false);
  ctx.fill();

  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(player.x * sz, player.y * sz);
	ctx.lineTo((player.x + Math.cos(player.direction) * 2) * sz, (player.y + Math.sin(player.direction) * 2) * sz);
	ctx.closePath();
	ctx.stroke();
};

Camera.prototype.drawTarget = function() {
  var ctx = this.ctx;
  ctx.strokeStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(this.width/2, this.height/2, 7, 0, Math.PI*2, false);
  ctx.moveTo(this.width/2-4, this.height/2);
  ctx.lineTo(this.width/2-9, this.height/2);
  ctx.moveTo(this.width/2+4, this.height/2);
  ctx.lineTo(this.width/2+9, this.height/2);
  ctx.moveTo(this.width/2, this.height/2-4);
  ctx.lineTo(this.width/2, this.height/2-9);
  ctx.moveTo(this.width/2, this.height/2+4);
  ctx.lineTo(this.width/2, this.height/2+9);
  ctx.stroke();
};

Camera.prototype.drawSky = function(direction, sky) {
  var width = sky.width * (this.height / sky.height) * 2;
  var left = (direction / CIRCLE) * -width;
  this.ctx.save();
  this.ctx.fillStyle = '#000';
  this.ctx.fillRect(0, 0, width, this.height);
  // this.ctx.drawImage(sky.image, 0, 0, width, this.height);
  // if (left < width - this.width) {
  //   this.ctx.drawImage(sky.image, left + width, 0, width, this.height);
  // }
  this.ctx.restore();
};

Camera.prototype.drawColumns = function(player, map) {
  this.ctx.save();
  for (var column = 0; column < this.resolution; column++) {
    var x = column / this.resolution - 0.5;
    var angle = Math.atan2(x, this.focalLength);
    var ray = map.cast(player, player.direction + angle, this.range);
    this.drawColumn(column, ray, angle, map);
  }
  this.ctx.restore();
};

Camera.prototype.drawColumn = function(column, ray, angle, map) {
  var ctx = this.ctx;
  var texture = map.wallTexture;
  var floor = map.floorTexture;
  var floorData = this.floorData;
  var shadow = map.shadowTexture;
  var left = Math.floor(column * this.spacing);
  var width = Math.ceil(this.spacing);
  var hit = -1;

  while (++hit < ray.length && ray[hit].height <= 0);
  
  for (var s = ray.length - 1; s >= 0; s--) {
    var step = ray[s];

    if (s === hit) {
      var textureX = Math.floor(texture.width * step.offset);
      var wall = this.project(step.height, angle, step.distance);

      ctx.globalAlpha = 1;
      for (var y = wall.top+wall.height - width; y < this.height; y += 3) {
        var dist = this.height / (2 * y - this.height);
        if (dist < 10 && floorData) {
          var weight = dist / step.distance;

          var currentFloorX = weight * step.x + (1 - weight) * player.x;
          var currentFloorY = weight * step.y + (1 - weight) * player.y;

          var floorTexX = ~~(currentFloorX * floor.width) % floor.width;
          var floorTexY = ~~(currentFloorY * floor.height) % floor.height;
          var index = (~~floorTexX + (~~floorTexY * floor.width)) << 2;

          ctx.fillStyle = 'rgba('+floorData[index]+','+floorData[index+1]+','+floorData[index+2]+',1)';
          ctx.fillRect(left, y, width, 4);
          
          // ctx.drawImage(floor.image, floorTexX, floorTexY, 1, 1, left, y, width, 2);
        }
      }
      ctx.drawImage(shadow.image, 0, 0, 1, shadow.height, left, 0, width, this.height);
      ctx.drawImage(texture.image, textureX, 0, 1, texture.height, left, wall.top, width, wall.height);
      
      ctx.fillStyle = '#000';
      ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
      ctx.fillRect(left, wall.top, width, wall.height);
    }
  }
};

Camera.prototype.project = function(height, angle, distance) {
  var z = distance * Math.cos(angle);
  var wallHeight = this.height * height / z;
  var bottom = this.height / 2 * (1 + 1 / z);
  return {
    top: bottom - wallHeight,
    height: wallHeight
  };
};


function GameLoop() {
  this.frame = this.frame.bind(this);
  this.lastTime = 0;
  this.callback = function() {};
}

GameLoop.prototype.start = function(callback) {
  this.callback = callback;
  requestAnimationFrame(this.frame);
};

GameLoop.prototype.frame = function(time) {
  var seconds = (time - this.lastTime) / 1000;
  this.lastTime = time;
  if (seconds < 0.2) this.callback(seconds);
  requestAnimationFrame(this.frame);
};

var time = 0, oldTime = time;
function drawFPS() {
  var fps = 0;
  if (time) {
    oldTime = time;
    time = Date.now();
    fps = 1000 / (time-oldTime);
  } else {
    time = Date.now();
  }
  var ctx = document.getElementById('fps').getContext('2d');
  ctx.clearRect(0, 0, 100, 50);
  ctx.fillStyle = '#FFF';
  ctx.font = '16px Ubuntu';
  ctx.fillText('FPS: ' + ~~fps, 25, 25);
}

var map;
var display = document.getElementById('display');
var minimap = document.getElementById('minimap');
var player = new Player(~~(Math.random()*10+1), ~~(Math.random()*10+1), Math.PI * 0.3);
var controls = new Controls();
var camera = new Camera(display, minimap, MOBILE ? 160 : 320, 0.8);
var loop = new GameLoop();

var id = Math.random().toString().replace(/\./g, '');
var ws = new WebSocket('wss://jaysonhutchison-github-io.glitch.me');

ws.onopen = function (event) {
  console.log('Connection is open ...');
};

ws.onerror = function (err) {
  console.log('err: ', err);
};

ws.onmessage = function (event) {
  var data = JSON.parse(event.data);
  map = new Map(data.map, data.mapSize);
  console.log('loaded map');

  camera.loadTextures(map);
  loop.start(function frame(seconds) {
    map.update(seconds);
    player.update(controls.states, map, seconds);
    camera.render(player, map, data);
    drawFPS(seconds);
    ws.send(JSON.stringify(player));
  });
};

ws.onclose = function() {
  console.log('Connection is closed...');
};
