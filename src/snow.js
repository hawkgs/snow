(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 640,
    height: 480,
    fps: 30,
    terminalVelocityRate: 5,
    snowflakeTtl: 30000,
    intensity: 3,
  };

  class Vector {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    add(arg) {
      const vector = this.__vectorize(arg);
      this.x += vector.x;
      this.y += vector.y;

      return this;
    }

    divide(arg) {
      const vector = this.__vectorize(arg);
      this.x /= vector.x;
      this.y /= vector.y;

      return this;
    }

    multiply(arg) {
      const vector = this.__vectorize(arg);
      this.x *= vector.x;
      this.y *= vector.y;

      return this;
    }

    magnitude() {
      return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
      const mag = this.magnitude();

      if (mag !== 0) {
        this.divide(new Vector(mag, mag));
      }

      return this;
    }

    limit(minX, maxX, minY, maxY) {
      this.x = Math.min(this.x, maxX);
      this.x = Math.max(minX, this.x);

      this.y = Math.min(this.y, maxY);
      this.y = Math.max(minY, this.y);
    }

    copy() {
      return new Vector(this.x, this.y);
    }

    __vectorize(arg) {
      if (arg instanceof Vector) {
        return arg;
      }
      if (typeof arg === 'number') {
        return new Vector(arg, arg);
      }
      throw new Error('Vector: Cannot vectorize argument.');
    }
  }

  class Force extends Vector {
    constructor(x, y, name, isVariable) {
      super(x, y);
      this.name = name;
      this.isVariable = isVariable;
    }

    calculate() {
      throw new Error('Force: calculate() not implemented.');
    }
  }

  class GravityForce extends Force {
    constructor() {
      super(0, 0.08, 'gravity', true);
    }

    calculate(state) {
      return this.copy().multiply(state.mass);
    }
  }

  class WindForce extends Force {
    constructor() {
      super(0.05, 0, 'wind', false);
    }
  }

  class DragForce extends Force {
    constructor() {
      super(0, 0, 'drag', true);
    }

    calculate(state) {
      const DRAG_C = 0.1;
      const drag = state.velocity;

      const speed = state.velocity.magnitude();
      const dragMagnitude = DRAG_C * speed * speed;

      drag.multiply(new Vector(-1, -1));
      drag.normalize();
      drag.multiply(new Vector(dragMagnitude, dragMagnitude));

      return drag;
    }
  }

  class Snowflake {
    constructor(x, y, size, translucency, config) {
      this.location = new Vector(x, y);
      this.acceleration = new Vector(0, 0);
      this.velocity = new Vector(0, 0);
      this.size = size;
      this.config = config;
      this.translucency = translucency;
      this.mass = this.__calcMass();
      this.createdAt = Date.now();
    }

    applyForce(force) {
      const fCopy = force.copy();
      fCopy.divide(this.mass);

      this.acceleration.add(fCopy);
    }

    update() {
      if (this.location.y >= this.config.height - this.size) {
        return;
      }

      this.velocity.add(this.acceleration);
      const terminalV = this.config.terminalVelocityRate * this.size;

      this.velocity.limit(0, terminalV, 0, terminalV);

      this.location.add(this.velocity);
      this.location.limit(
        -300,
        this.config.width + 300,
        0,
        this.config.height - this.size
      );

      this.acceleration = new Vector(0, 0);
    }

    __calcMass() {
      const mass = this.size * this.size;

      return new Vector(mass, mass);
    }
  }

  class System {
    constructor(config) {
      this.config = config;
      this.snowflakes = [];
      this.forces = [];
    }

    applyForce(force) {
      this.forces.push(force);
    }

    update() {
      this.__createSnowflakeLayer();

      const markedForDestruct = [];

      for (let i = 0; i < this.snowflakes.length; i++) {
        const sf = this.snowflakes[i];

        if (Date.now() - sf.createdAt > this.config.snowflakeTtl) {
          markedForDestruct.push(i);
        } else {
          for (const f of this.forces) {
            sf.applyForce(
              !f.isVariable
                ? f
                : f.calculate({
                    acceleration: sf.acceleration.copy(),
                    velocity: sf.velocity.copy(),
                    mass: sf.mass.copy(),
                  })
            );
          }
          sf.update();
        }
      }

      for (const idx of markedForDestruct) {
        this.snowflakes.splice(idx, 1);
      }
    }

    __createSnowflakeLayer() {
      for (let i = 0; i <= this.config.intensity; i++) {
        this.__createSnowflake();
      }
    }

    __createSnowflake() {
      const x = getRandom(-300, this.config.width + 300);
      const y = getRandom(-1000, -500);
      const translucency = getRandom(0.1, 1);
      const size = getRandom(1, 5);

      this.snowflakes.push(
        new Snowflake(x, y, size, translucency, this.config)
      );
    }
  }

  function getRandom(min, max) {
    return Math.random() * (max - min) + min;
  }

  function createCanvas(config) {
    const canvas = document.createElement('canvas');
    canvas.id = 'snow-canvas';
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    return canvas;
  }

  function initializeSystem(config, canvas) {
    const system = new System(config);
    system.applyForce(new GravityForce());
    system.applyForce(new DragForce());
    system.applyForce(new WindForce());

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      system.update();

      for (const sf of system.snowflakes) {
        ctx.beginPath();
        ctx.arc(
          sf.location.x,
          sf.location.y,
          sf.size / 2,
          0,
          2 * Math.PI,
          false
        );
        ctx.fillStyle = `rgba(255, 255, 255, ${sf.translucency})`;
        ctx.fill();
      }
    }

    function animate(then, fpsInterval, elapsed) {
      requestAnimationFrame(() => animate(then, fpsInterval, elapsed));

      const now = Date.now();
      elapsed = now - then;

      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        draw();
      }
    }

    function startAnimating(fps) {
      const fpsInterval = 1000 / fps;
      const then = Date.now();
      const elapsed = 0;

      animate(then, fpsInterval, elapsed);
    }

    startAnimating(config.fps);
  }

  /**
   *
   * @param {HTMLElement} el
   */
  function attachToElement(el, config) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const canvas = createCanvas(cfg);
    initializeSystem(cfg, canvas);

    el.appendChild(canvas);
  }

  window.Snow = {
    attachToElement,
  };
})();
