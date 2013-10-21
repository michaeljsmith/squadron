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

var deferred = [];

function defer(fn) {
  deferred.push(fn);
}

function cleanup() {
  for (var i = deferred.length - 1; i >= 0; --i) {
    deferred[i]();
  }

  deferred = [];
}

function ReadPrimitive(value) {
  this.value_ = value;
  this.listeners_ = new ListenerSet();
}

ReadPrimitive.prototype.get = function() {
  return this.value_;
};

ReadPrimitive.prototype.set_ = function(value) {
  this.value_ = value;
  this.listeners_.report();
};

ReadPrimitive.prototype.listeners = function() {
  return this.listeners_;
};

function Const(value) {
  // TODO: optimize by ignoring listeners.
  return new ReadPrimitive(value);
}

ReadWritePrimitive.prototype = new ReadPrimitive();
ReadWritePrimitive.prototype.constructor = ReadWritePrimitive;

function ReadWritePrimitive(value) {
  ReadPrimitive.call(this, value);
}

ReadWritePrimitive.prototype.set = function(value) {
  this.set_(value);
};

function Vector(x_, y_) {
  return {
    x: x_,
    y: y_
  };
}

function Application(fn) {
  var args = Array.prototype.slice.call(arguments, 1);

  function calculate() {
    var argValues = [];
    for (var i = 0; i < args.length; ++i) {
      argValues.push(args[i].get());
    }

    return fn.apply(this, argValues);
  }

  var result = new ReadPrimitive(calculate());

  function onArgChanged() {
    result.set_(calculate());
  }

  for (var i = 0; i < args.length; ++i) {
    var arg = args[i];

    arg.listeners().add(onArgChanged);

    defer(function() {
      arg.listeners().remove(onArgChanged);
    });
  }

  return result;
}

function Sin(x) {
  return Application(Math.sin, x);
}

function Sum() {
  function calculate() {
    return Array.prototype.reduce.call(arguments,
      function (x, y) {return x + y});
  }

  var args = Array.prototype.slice.call(arguments, 0);
  return Application.apply(this, [calculate].concat(args));
}

function Product() {
  function calculate() {
    return Array.prototype.reduce.call(arguments,
      function (x, y) {return x * y});
  }

  var args = Array.prototype.slice.call(arguments, 0);
  return Application.apply(this, [calculate].concat(args));
}

// Create the canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext("2d");
canvas.width = 512;
canvas.height = 480;
document.body.appendChild(canvas);

var sprites = [];

function Sprite(position) {
  var sprite = {
    render: function(ctx) {
      ctx.fillStyle = "#FF0000";
      var x = position.x.get();
      var y = position.y.get();
      ctx.fillRect(x - 10, y - 10, 20, 20);
    }
  };

  sprites.push(sprite);

  defer(function() {
    var idx = sprites.indexOf(sprite);

    if (idx == -1) {
      throw "Sprite cleaned up twice.";
    }

    sprites.splice(idx, 1);
  });
}

function render() {
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (var i = 0; i < sprites.length; ++i) {
    var sprite = sprites[i];

    sprite.render(ctx);
  }
}

var time = new ReadWritePrimitive(0);

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

var sprite = Sprite(Vector(Sum(Const(200), Product(Const(30), Sin(time))), Product(Const(20), time)));

runAnimLoop(update);
