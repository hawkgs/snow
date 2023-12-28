(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    width: 640,
    height: 480,
    fps: 30,
    terminalVelocityRate: 5,
    snowflakeTtl: 30000,
    intensity: 3,
    offScreenOffset: 300,
  };

  class Vector {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    /**
     *
     * @param {Vector | number} arg
     * @returns
     */
    add(arg) {
      const vector = this.__vectorize(arg);
      this.x += vector.x;
      this.y += vector.y;

      return this;
    }

    /**
     *
     * @param {Vector | number} arg
     * @returns
     */
    divide(arg) {
      const vector = this.__vectorize(arg);
      this.x /= vector.x;
      this.y /= vector.y;

      return this;
    }

    /**
     *
     * @param {Vector | number} arg
     * @returns
     */
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

    rotate(degrees) {
      const rads = 2 * Math.PI * (degrees / 360);
      const cos = Math.cos(rads);
      const sin = Math.sin(rads);

      this.x = this.x * cos - this.y * sin;
      this.y = this.x * sin + this.y * cos;

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
    constructor(x, y, name) {
      super(x, y);
      this.name = name;
    }
  }

  function gravityForceFactory(state) {
    const GRAVITY_C = 0.08;
    const v = new Vector(0, GRAVITY_C);
    v.multiply(state.mass);

    return new Force(v.x, v.y, 'gravity');
  }

  function windForceFactory() {
    const WIND_D = 330;
    const WIND_MAG = 0.08;
    const v = new Vector(WIND_MAG, 0);
    v.rotate(WIND_D);

    return new Force(v.x, v.y, 'wind');
  }

  function dragForceFactory(state) {
    const DRAG_C = 0.1;
    const v = state.velocity;

    const speed = state.velocity.magnitude();
    const dragMagnitude = DRAG_C * speed * speed;

    v.multiply(-1);
    v.normalize();
    v.multiply(dragMagnitude);

    return new Force(v.x, v.y, 'drag');
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
      this.atRest = false;
    }

    applyForce(force) {
      const fCopy = force.copy();
      fCopy.divide(this.mass);

      this.acceleration.add(fCopy);
    }

    update() {
      const c = this.config;

      if (this.atRest || this.location.y >= c.height - this.size) {
        this.atRest = true;
        return;
      }

      this.velocity.add(this.acceleration);
      const terminalV = c.terminalVelocityRate * this.size;

      this.velocity.limit(0, terminalV, 0, terminalV);

      this.location.add(this.velocity);
      this.location.limit(
        c.offScreenOffset * -1,
        c.width + c.offScreenOffset,
        0,
        c.height - this.size
      );

      this.acceleration.multiply(0);
    }

    __calcMass() {
      const mass = this.size * this.size;
      return mass;
    }
  }

  class System {
    constructor(config) {
      this.config = config;
      this.snowflakes = [];
      this.forceFactories = [];
    }

    applyForceFactory(factory) {
      this.forceFactories.push(factory);
    }

    update() {
      this.__createSnowflakeLayer();

      const markedForDestruct = [];

      for (let i = 0; i < this.snowflakes.length; i++) {
        const sf = this.snowflakes[i];

        if (Date.now() - sf.createdAt > this.config.snowflakeTtl) {
          markedForDestruct.push(i);
        } else if (!sf.atRest) {
          for (const factory of this.forceFactories) {
            sf.applyForce(
              factory({
                acceleration: sf.acceleration.copy(),
                velocity: sf.velocity.copy(),
                mass: sf.mass,
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
      const c = this.config;
      const x = getRandom(c.offScreenOffset * -1, c.width + c.offScreenOffset);
      const y = getRandom(-500, -200);
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
    system.applyForceFactory(gravityForceFactory);
    system.applyForceFactory(dragForceFactory);
    system.applyForceFactory(windForceFactory);

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
