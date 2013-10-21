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

function ListenerSet() {
  this.listeners = [];
  this.lockCount = 0;
}

ListenerSet.prototype.report = function() {
  ++this.lockCount;

  for (var i = 0; i < this.listeners.length; ++i) {
    var listener = this.listeners[i];
    if (listener !== null) {
      listener.apply(this, arguments);
    }
  }

  if (0 == --this.lockCount) {
    this.listeners = this.listeners.filter(function (l) {return l !== null;});
  }
};

ListenerSet.prototype.add = function(listener) {
  if (listener === null || typeof listener === 'undefined') {
    throw "listener null";
  }

  if (this.listeners.indexOf(listener) != -1) {
    throw "duplicate listener";
  }

  this.listeners.push(listener);
};

ListenerSet.prototype.remove = function(listener) {
  if (listener === null || typeof listener === 'undefined') {
    throw "listener null";
  }

  var idx = this.listeners.indexOf(listener);
  if (idx == -1) {
    throw "invalid listener";
  }

  this.listeners[idx] = null;
};

function Primitive(value) {
  this.value_ = value;
  this.listeners_ = new ListenerSet();
}

Primitive.prototype.cleanup = function() {
};

Primitive.prototype.get = function() {
  return this.value_;
};

Primitive.prototype.set = function(value) {
  this.value_ = value;
  this.listeners_.report();
};

Primitive.prototype.listeners = function() {
  return this.listeners_;
};

function Vector(x, y) {
  this.x = x;
  this.y = y;
}

Vector.prototype.cleanup = function() {
};

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.body.appendChild(canvas);

var sprites = [];

function Sprite(position) {
  this.position_ = position;
  sprites.push(this);
}

Sprite.prototype.cleanup = function() {
  var idx = sprites.indexOf(this);

  if (idx == -1) {
    throw "Sprite cleaned up twice.";
  }

  sprites.splice(idx, 1);
};

Sprite.prototype.render = function(ctx) {
  ctx.fillStyle = "#FF0000";
  var x = this.position_.x.get();
  var y = this.position_.y.get();
  ctx.fillRect(x - 10, y - 10, x + 10, x + 10);
};

function render() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (var i = 0; i < sprites.length; ++i) {
    var sprite = sprites[i];

    sprite.render(ctx);
  }
}

var time = new Primitive(0);

// The main game loop
var lastTime = Date.now();
function update() {
  var now = Date.now();
  var dt = Math.min(0.1, (now - lastTime) / 1000.0);
  lastTime = now;
  time.set(time.get() + dt);

  render();
}

function runAnimLoop(fn) {
  function run() {
    fn();
    window.webkitRequestAnimationFrame(run);
  }

  window.webkitRequestAnimationFrame(run);
}

var sprite = new Sprite(new Vector(time, time));

runAnimLoop(update);

