(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 640,
    height: 480,
    fps: 30,
    terminalVelocityRate: 5,
    snowflakeTtl: 15000,
    intensity: 2,
  };

  class Vector {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    add(vector) {
      this.x += vector.x;
      this.y += vector.y;
    }

    divide(vector) {
      this.x /= vector.x;
      this.y /= vector.y;
    }

    multiply(vector) {
      this.x *= vector.x;
      this.y *= vector.y;
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
  }

  class Force extends Vector {
    constructor(x, y, name) {
      super(x, y);
      this.name = name;
    }

    update() {
      /* noop */
    }
  }

  class GravityForce extends Force {
    constructor() {
      super(0, 0.08, 'gravity');
    }
  }

  class AirResistanceForce extends Force {
    constructor() {
      super(0, -0.05, 'air-resistance');
    }
  }

  class WindForce extends Force {
    constructor() {
      super(0.005, 0, 'wind');
    }
  }

  class Snowflake {
    constructor(x, y, size, config) {
      this.location = new Vector(x, y);
      this.acceleration = new Vector(0, 0);
      this.velocity = new Vector(0, 0);
      this.size = size;
      this.config = config;
      this.createdAt = Date.now();
    }

    get mass() {
      return new Vector(this.size, this.size);
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
        -100,
        this.config.width + 100,
        0,
        this.config.height - this.size
      );

      this.acceleration = new Vector(0, 0);
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

      this.snowflakes.forEach((sf, idx) => {
        if (Date.now() - sf.createdAt > this.config.snowflakeTtl) {
          markedForDestruct.push(idx);
        } else {
          this.forces.forEach((f) => {
            sf.applyForce(f);
          });
          sf.update();
        }
      });

      markedForDestruct.forEach((idx) => {
        this.snowflakes.splice(idx, 1);
      });
    }

    __createSnowflakeLayer() {
      for (let i = 0; i <= this.config.intensity; i++) {
        this.__createSnowflake();
      }
    }

    __createSnowflake() {
      const x = getRandom(-100, this.config.width + 100);
      const y = getRandom(-50, -10);
      const size = getRandom(1, 5);

      this.snowflakes.push(new Snowflake(x, -20, size, this.config));
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
    system.applyForce(new AirResistanceForce());
    system.applyForce(new WindForce());

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      system.update();

      system.snowflakes.forEach((sf) => {
        ctx.fillStyle = 'rgb(86, 227, 255)';
        ctx.fillRect(sf.location.x, sf.location.y, sf.size, sf.size);
      });
    }

    function startAnimating(fps) {
      const fpsInterval = 1000 / fps;
      const then = Date.now();
      const elapsed = 0;

      animate(then, fpsInterval, elapsed);
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
