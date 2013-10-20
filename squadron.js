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

QuadTree.prototype.visit = function(query, visitor) {
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
              nodeX + x * size / 2, nodeY + y * size / 2);
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
    
    // Find the payload in the list of entries.
    var idx = -1;
    for (var i = 0; i < node.entries_.length; ++i) {
      if (node.entries_[i].payload === entry.payload) {
        idx = i;
      }
    }

    if (idx == -1) {
      throw "missing entry";
    }

    node.entries_.splice(idx, 1);
  });
};

QuadTree.prototype.findNode_ = function(entry, handler) {
  while (entry.area.l < -this.size_ ||
      entry.area.t < -this.size_ ||
      entry.area.r >= this.size_ ||
      entry.area.b >= this.size_) {
    this.increaseSize_();
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
    var childX = (entry.area.l >= nodeX + size / 2) ? 1 : 0;
    var childY = (entry.area.t >= nodeY + size / 2) ? 1 : 0;
    var childIdx = childY * 2 + childX;
    var child = node.children_[childIdx];

    // Create the child node if it doesn't exist.
    if (child === null) {
      child = new Node();
      node.children_[childIdx] = child;
    }
    recurse(child, size / 2,
        nodeX + childX * size / 2, nodeY + childY * size / 2);
  }

  recurse(this.root_, this.size_ * 2, -this.size_, -this.size_);
};

QuadTree.prototype.increaseSize_ = function() {
  var root = this.root_;
  var newRoot = new Node();

  for (var y = 0; y < 2; ++y) {
    for (var x = 0; x < 2; ++x) {
      var newChild = new Node();
      var childIdx = 2 * y + x;
      var grandChildIdx = 2 * (1 - y) + (1 - x);
      newChild.children_[grandChildIdx] = root.children_[childIdx];
      newRoot.children_[childIdx] = newChild;
    }
  }

  this.root_ = newRoot;
  this.size_ *= 2;
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

var quadTree = new QuadTree();

function squareRect(square) {
  return new Rect(
      square[0], square[1],
      square[0] + SQUARE_SIZE, square[1] + SQUARE_SIZE);
}

function squareEntry(square) {
  return new Entry(squareRect(square), square);
}

var squares = new Array();
for (var i = 0; i < NUM_SQUARES; ++i) {
  var x = Math.random() * (canvas.width - SQUARE_SIZE);
  var y = Math.random() * (canvas.height - SQUARE_SIZE);
  var vx = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  var vy = (2 * Math.random() - 1) * SQUARE_SPEED_MAX;
  squares[i] = [x, y, vx, vy];
  quadTree.insert(squareEntry(squares[i]));
}

function updateTimers(dt) {
  for (var i = 0; i < squares.length; ++i) {
    var square = squares[i];

    quadTree.remove(squareEntry(square));

    square[0] += dt * square[2];
    if (square[0] < 0 && square[2] < 0) {
      square[2] *= -1;
    }
    if (square[0] + SQUARE_SIZE >= canvas.width && square[2] > 0) {
      square[2] *= -1;
    }

    square[1] += dt * square[3];
    if (square[1] < 0 && square[3] < 0) {
      square[3] *= -1;
    }
    if (square[1] + SQUARE_SIZE >= canvas.height && square[3] > 0) {
      square[3] *= -1;
    }

    quadTree.insert(squareEntry(square));
  }
}

function render() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#FF0000";
  ctx.strokeStyle = "#FF0000";
  for (var i = 0; i < squares.length; ++i) {
    var intersects = false;
    var foundSelf = false;
    quadTree.visit(squareRect(squares[i]), function(entry) {
      if (entry.payload !== squares[i]) {
        intersects = true;
      } else {
        foundSelf = true;
      }
    });
    
    if (!foundSelf) {
      throw "self not in array";
    }

    if (intersects) {
      ctx.strokeRect(squares[i][0], squares[i][1], 20, 20);
    } else {
      ctx.fillRect(squares[i][0], squares[i][1], 20, 20);
    }
  }
}

// The main game loop
var lastTime = Date.now();
function update() {
    var now = Date.now();
    var dt = Math.min(0.1, (now - lastTime) / 1000.0);

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
