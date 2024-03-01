(function () {
  'use strict';

  /**
   * Snowfall configuration object.
   * @typedef {Object} SnowfallConfig
   * @property {number} width - Width of the Canvas element.
   * @property {number} height - Height of the Canvas element.
   * @property {number} fps - Animation FPS.
   * @property {number} gravity - Gravity. Decimal numbers less than 1 render realistic results.
   * @property {number} windMagnitude - Wind magnitude. Decimal numbers less than 1 render realistic results.
   * @property {number} dragMagnitude - Drag magnitude. Decimal numbers less than 1 render realistic results.
   * @property {number} terminalVelocityRate - The rate represents the max velocity based on the mass of the snowflake.
   * @property {number} snowflakeTtl - Snowflake time to live in miliseconds.
   * @property {number} snowfallIntensity - Snowfall intensity. Unbound integer. Keep within 1-50.
   * @property {number} offScreenOffset - Offset negative and positive X axis snowfall offset in pixels.
   */

  /**
   * Snowflake/particle state.
   * @typedef {Object} SnowflakeState
   * @property {Vector} location - Location vector copy.
   * @property {Vector} velocity - Velocity vector copy.
   * @property {number} mass - Mass.
   */

  /**
   * @type {SnowfallConfig}
   */
  const DEFAULT_CONFIG = {
    width: 640,
    height: 480,
    fps: 30,
    gravity: 4, // Note(Georgi): Using positive Y since the Canvas Y axis is inverted (top-left corner is 0,0).
    dragMagnitude: 0.1,
    terminalVelocityRate: 10,
    snowflakeTtl: 1500,
    snowfallIntensity: 6,
    offScreenOffset: 200,
  };

  class Vector {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    /**
     * @param {Vector | number} arg
     * @returns Vector
     */
    add(arg) {
      const vector = this.__vectorize(arg);
      this.x += vector.x;
      this.y += vector.y;

      return this;
    }

    /**
     * @param {Vector | number} arg
     * @returns Vector
     */
    divide(arg) {
      const vector = this.__vectorize(arg);
      this.x /= vector.x;
      this.y /= vector.y;

      return this;
    }

    /**
     * @param {Vector | number} arg
     * @returns Vector
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
        this.divide(mag);
      }

      return this;
    }

    /**
     * @param {number} minX
     * @param {number} maxX
     * @param {number} minY
     * @param {number} maxY
     * @returns Vector
     */
    limit(minX, maxX, minY, maxY) {
      this.x = Math.min(this.x, maxX);
      this.x = Math.max(minX, this.x);

      this.y = Math.min(this.y, maxY);
      this.y = Math.max(minY, this.y);

      return this;
    }

    copy() {
      return new Vector(this.x, this.y);
    }

    /**
     * @param {Vector | number} arg
     * @returns Vector
     */
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

  /**
   * @param {SnowfallConfig} config
   * @param {SnowflakeState} state
   * @returns Vector
   */
  function gravityForceFactory(config, state) {
    return new Vector(0, config.gravity * state.mass);
  }

  /**
   * @param {SnowfallConfig} config
   * @param {SnowflakeState} state
   * @returns Vector
   */
  function dragForceFactory(config, state) {
    const v = state.velocity;
    const speed = v.magnitude();
    // Note(Georgi): Simplified drag equation.
    const dragMagnitude = config.dragMagnitude * speed * speed;

    // Note(Georgi): Invert force.
    v.multiply(-1);
    v.normalize();

    return v.multiply(dragMagnitude);
  }

  class Snowflake {
    /**
     *
     * @param {number} x
     * @param {number} y
     * @param {number} size
     * @param {number} translucency
     * @param {SnowfallConfig} config
     */
    constructor(x, y, size, config) {
      this.location = new Vector(x, y);
      this.acceleration = new Vector(0, 0);
      this.velocity = new Vector(0, 0);
      this.size = size;
      this.config = config;
      this.mass = this.__calcMass();
      this.createdAt = Date.now();
      this.atRest = false;
    }

    /**
     * @param {Vector} force
     */
    applyForce(force) {
      // Note(Georgi): 2nd Newton's law
      force.divide(this.mass);
      this.acceleration.add(force);
    }

    update() {
      if (this.atRest || this.location.y >= this.config.height - this.size) {
        this.atRest = true;
        return;
      }

      this.velocity.add(this.acceleration);

      const c = this.config;
      // Note(Georgi): Calculate terminal velocity based on the size of the snowflake.
      const terminalV = c.terminalVelocityRate * this.size;
      this.velocity.limit(-terminalV, terminalV, -terminalV, terminalV);

      this.location.add(this.velocity);
      this.location.limit(
        -c.offScreenOffset,
        c.width + c.offScreenOffset,
        0,
        c.height - this.size,
      );

      this.acceleration.multiply(0);
    }

    __calcMass() {
      // Note(Georgi): Quadratic mass, so that heavier objects have increased impact.
      return this.size * this.size;
    }
  }

  class Snowfall {
    /**
     * @param {SnowfallConfig} config
     */
    constructor(config) {
      this.config = config;
      this.snowflakes = [];
      this.forceFactories = [];

      setInterval(() => {
        console.log('Rendered snowflakes:', this.snowflakes.length);
      }, 1500);
    }

    applyForceFactory(factory) {
      this.forceFactories.push(factory);
    }

    update() {
      this.__createSnowflakeLayer();

      const markedForDestruct = [];

      for (let i = 0; i < this.snowflakes.length; i++) {
        const sf = this.snowflakes[i];

        if (Date.now() - sf.createdAt >= this.config.snowflakeTtl) {
          markedForDestruct.push(i);
        } else if (!sf.atRest) {
          for (const factory of this.forceFactories) {
            sf.applyForce(
              factory(this.config, {
                location: sf.location.copy(),
                velocity: sf.velocity.copy(),
                mass: sf.mass,
              }),
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
      for (let i = 0; i < this.config.snowfallIntensity; i++) {
        this.__createSnowflake();
      }
    }

    __createSnowflake() {
      const c = this.config;
      const x = getRandom(-c.offScreenOffset, c.width + c.offScreenOffset);
      // Note(Georgi): Start snowfall off screen so that snowflakes can accelerate.
      const y = getRandom(-500, -200);
      const size = getRandom(3, 4);

      this.snowflakes.push(new Snowflake(x, y, size, this.config));
    }
  }

  /**
   * @param {number} min
   * @param {number} max
   * @returns number
   */
  function getRandom(min, max) {
    return Math.round(Math.random() * (max - min) + min);
  }

  /**
   * @param {SnowfallConfig} config
   * @returns HTMLCanvasElement
   */
  function createCanvas(config) {
    const canvas = document.createElement('canvas');
    canvas.className = 'snow-canvas';
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    return canvas;
  }

  /**
   * @param {SnowfallConfig} config
   * @param {HTMLCanvasElement} canvas
   */
  function initSnowfall(config, canvas) {
    const snow = new Snowfall(config);
    snow.applyForceFactory(gravityForceFactory);
    snow.applyForceFactory(dragForceFactory);

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      snow.update();

      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(141, 190, 203, 0.9)`;

      for (const sf of snow.snowflakes) {
        ctx.moveTo(sf.location.x, sf.location.y);
        ctx.lineTo(sf.location.x, sf.location.y + sf.size * 2);

        ctx.stroke();
      }

      ctx.fill();
    }

    /**
     * @param {number} fpsInterval
     * @param {number} then
     * @param {number} elapsed
     */
    function animate(fpsInterval, then, elapsed) {
      requestAnimationFrame(() => animate(fpsInterval, then, elapsed));

      const now = Date.now();
      elapsed = now - then;

      if (elapsed > fpsInterval) {
        then = now - (elapsed % fpsInterval);

        draw();
      }
    }

    /**
     * @param {number} fps
     */
    function startAnimating(fps) {
      const fpsInterval = 1000 / fps;
      animate(fpsInterval, Date.now(), 0);
    }

    startAnimating(config.fps);
  }

  /**
   * Attach HTML Canvas to the given element and initialize the snowfall.
   * @param {HTMLElement} el - Host element.
   * @param {SnowfallConfig} config - Snowfall configuration object.
   */
  function attachToElement(el, config) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const canvas = createCanvas(cfg);
    el.appendChild(canvas);

    initSnowfall(cfg, canvas);
  }

  window.Snow = {
    attachToElement,
  };
})();
