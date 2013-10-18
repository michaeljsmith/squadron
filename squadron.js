"use strict";

function Point(x, y) {
  this.x = x;
  this.y = y;
}

function Rect(l, t, r, b) {
  this.l = l;
  this.t = t;
  this.r = r;
  this.b = b;
}

function Entry(area, payload) {
  this.area = area;
  this.payload = payload;
}

function Node() {
  this.entries_ = [];
  this.children_ = [null, null, null, null];
}

function QuadTree() {
  this.size_ = 1;
  this.root_ = new Node();
}

QuadTree.prototype.visit = function(visitor, query) {
  function visitRecurse(node, size, nodeX, nodeY) {
    // Check whether we loosely fit (ie objects here could overlap the next
    // items.
    if (nodeX > query.r || nodeX + size * 2 < query.l ||
        nodeY > query.b || nodeY + size * 2 < query.t) {
      return;
    }

    for (var i = 0; i < node.entries_.length; ++i) {
      var entry = node.entries_[i];

      if (entry.area.l < query.r && entry.area.r > query.l &&
          entry.area.t < query.b && entry.area.b > query.t) {
        visitor(entry);
      }
    }

    for (var y = 0; y < 2; ++y) {
      for (var x = 0; x < 2; ++x) {
        var child = node.children_[y * 2 + x];
        if (child !== null) {
          visitRecurse(child, size / 2,
              x * (nodeX + size / 2), y * (nodeY + size / 2));
        }
      }
    }
  }

  visitRecurse(this.root_, this.size_ * 2, -this.size_, -this.size_);
};

QuadTree.prototype.insert = function(entry) {
  this.findNode_(entry, function(node) {
    node.entries_.push(entry);
  });
};

QuadTree.prototype.remove = function(entry) {
  this.findNode_(entry, function(node) {
    var idx = node.entries_.indexOf(entry);
    if (idx == -1) {
      throw "missing entry".
    }

    node.entries_.pop(idx);
  });
};

QuadTree.prototype.findNode_ = function(entry, handler) {
  if (entry.area.l < -this.size_ ||
      entry.area.t < -this.size_ ||
      entry.area.r >= this.size_ ||
      entry.area.b >= this.size_) {
    throw "too small";
  }

  var entrySize = Math.max(
      entry.area.r - entry.area.l, entry.area.b - entry.area.t);

  function recurse(node, size, nodeX, nodeY) {

    // Check whether this node is the right size for this entry.
    if (entrySize > size / 2) {
      handler(node);
      return;
    }

    // Otherwise recurse.
    var childX = (entry.area.x >= nodeX + size / 2) ? 1 : 0;
    var childY = (entry.area.y >= nodeY + size / 2) ? 1 : 0;
    var childIdx = childY * 2 + childX;
    var child = node.children_[childIdx];

    // Create the child node if it doesn't exist.
    if (child === null) {
      child = new Node();
      node.children_[childIdx] = child;
    }
    recurse(child, size / 2,
        nodeX + childX * size / 2, nodeY + childX * size / 2);
  }

  recurse(this.root_, this.size_ * 2, -this.size, -this.size_);
};

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.body.appendChild(canvas);

var NUM_SQUARES = 100;
var SQUARE_SIZE = 20;
var SQUARE_SPEED_MAX = 10;

var squares = new Array();
for (var i = 0; i < NUM_SQUARES; ++i) {
  var x = Math.random() * (canvas.width - SQUARE_SIZE);
  var y = Math.random() * (canvas.height - SQUARE_SIZE);
  var vx = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  var vy = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  squares[i] = [x, y, vx, vy];
}

function updateTimers(dt) {
  for (var i = 0; i < squares.length; ++i) {
    squares[i][0] += dt * squares[i][2];
    if (squares[i][0] < 0 && squares[i][2] < 0) {
      squares[i][2] *= -1;
    }
    if (squares[i][0] + SQUARE_SIZE >= canvas.width && squares[i][2] > 0) {
      squares[i][2] *= -1;
    }

    squares[i][1] += dt * squares[i][3];
    if (squares[i][1] < 0 && squares[i][3] < 0) {
      squares[i][3] *= -1;
    }
    if (squares[i][1] + SQUARE_SIZE >= canvas.height && squares[i][3] > 0) {
      squares[i][3] *= -1;
    }
  }
}

function render() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#FF0000";
  for (var i = 0; i < squares.length; ++i) {
    ctx.fillRect(squares[i][0], squares[i][1], 20, 20);
  }
}

// The main game loop
var lastTime = Date.now();
function update() {
    var now = Date.now();
    var dt = (now - lastTime) / 1000.0;

    updateTimers(dt);
    render();

    lastTime = now;
}

function runAnimLoop(fn) {
  function run() {
    fn();
    window.webkitRequestAnimationFrame(run);
  }

  window.webkitRequestAnimationFrame(run);
}

runAnimLoop(update);
