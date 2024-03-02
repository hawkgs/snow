(function () {
  'use strict';

  /**
   * This is a modified version of https://github.com/hawkgs/snow
   * that is using a bit more functional approach by not creating
   * classes which might become a bottleneck for high-intensity
   * animations where instantiation of objects happen frequently.
   */

  /**
   * Rainfall configuration object.
   * @typedef {Object} RainfallConfig
   * @property {number} width - Width of the Canvas element.
   * @property {number} height - Height of the Canvas element.
   * @property {number} fps - Animation FPS.
   * @property {number} gravity - Gravity. Decimal numbers less than 1 render realistic results.
   * @property {number} dragMagnitude - Drag magnitude. Decimal numbers less than 1 render realistic results.
   * @property {number} terminalVelocityRate - The rate represents the max velocity based on the mass of the raindrop.
   * @property {number} raindropTtl - Raindrop time to live in miliseconds.
   * @property {number} rainfallIntensity - Rainfall intensity. Unbound integer. Keep within 1-50.
   * @property {number} offScreenOffset - Offset negative and positive X axis rainfall offset in pixels.
   */

  /**
   * Particle state.
   * @typedef {Object} RainfallState
   * @property {Vector} location - Location vector copy.
   * @property {Vector} velocity - Velocity vector copy.
   * @property {number} mass - Mass.
   */

  /**
   * @type {RainfallConfig}
   */
  const DEFAULT_CONFIG = {
    width: 640,
    height: 480,
    fps: 30,
    gravity: 4, // Note(Georgi): Using positive Y since the Canvas Y axis is inverted (top-left corner is 0,0).
    dragMagnitude: 0.1,
    terminalVelocityRate: 10,
    raindropTtl: 1500,
    rainfallIntensity: 6,
    offScreenOffset: 200,
  };

  function __vectorize(arg) {
    if (arg.x !== undefined && arg.y !== undefined) {
      return arg;
    }
    if (typeof arg === 'number') {
      return { x: arg, y: arg };
    }
    throw new Error('Vector: Cannot vectorize argument.');
  }

  /**
   * Vector manipulation functions
   */
  const Vector = {
    create: (x, y) => ({ x, y }),

    add: (v, arg) => {
      const vector = __vectorize(arg);
      v.x += vector.x;
      v.y += vector.y;
    },

    divide: (v, arg) => {
      const vector = __vectorize(arg);
      v.x /= vector.x;
      v.y /= vector.y;
    },

    multiply: (v, arg) => {
      const vector = __vectorize(arg);
      v.x *= vector.x;
      v.y *= vector.y;
    },

    magnitude: (v) => {
      return Math.sqrt(v.x * v.x + v.y * v.y);
    },

    normalize: (v) => {
      const mag = Vector.magnitude(v);

      if (mag !== 0) {
        Vector.divide(v, mag);
      }
    },

    limit: (v, minX, maxX, minY, maxY) => {
      v.x = Math.min(v.x, maxX);
      v.x = Math.max(minX, v.x);

      v.y = Math.min(v.y, maxY);
      v.y = Math.max(minY, v.y);
    },

    copy: (v) => {
      return { ...v };
    },
  };

  /**
   * Raindrop manipulation functions
   */
  const Raindrop = {
    create: (x, y, size, config) => ({
      location: Vector.create(x, y),
      acceleration: Vector.create(0, 0),
      velocity: Vector.create(0, 0),
      size: size,
      config: config,
      mass: size * size,
      createdAt: Date.now(),
      atRest: false,
    }),

    applyForce: (drop, force) => {
      Vector.divide(force, drop.mass);
      Vector.add(drop.acceleration, force);
    },

    update: (drop) => {
      if (drop.atRest || drop.location.y >= drop.config.height - drop.size) {
        drop.atRest = true;
        return;
      }

      Vector.add(drop.velocity, drop.acceleration);

      const c = drop.config;
      // Note(Georgi): Calculate terminal velocity based on the size of the raindrop.
      const terminalV = c.terminalVelocityRate * drop.size;
      Vector.limit(drop.velocity, -terminalV, terminalV, -terminalV, terminalV);

      Vector.add(drop.location, drop.velocity);
      Vector.limit(
        drop.location,
        -c.offScreenOffset,
        c.width + c.offScreenOffset,
        0,
        c.height - drop.size,
      );

      Vector.multiply(drop.acceleration, 0);
    },
  };

  /**
   * @param {RainfallConfig} config
   * @param {RainfallState} state
   * @returns Vector
   */
  function gravityForceFactory(config, state) {
    return Vector.create(0, config.gravity * state.mass);
  }

  /**
   * @param {RainfallConfig} config
   * @param {RainfallState} state
   * @returns Vector
   */
  function dragForceFactory(config, state) {
    const v = state.velocity;
    const speed = Vector.magnitude(v);
    // Note(Georgi): Simplified drag equation.
    const dragMagnitude = config.dragMagnitude * speed * speed;

    // Note(Georgi): Invert force.
    Vector.multiply(v, -1);
    Vector.normalize(v);
    Vector.multiply(v, dragMagnitude);

    return v;
  }

  class Rainfall {
    /**
     * @param {RainfallConfig} config
     */
    constructor(config) {
      this.config = config;
      this.drops = [];
      this.forceFactories = [];

      setInterval(() => {
        console.log('Rendered drops:', this.drops.length);
      }, 1500);
    }

    applyForceFactory(factory) {
      this.forceFactories.push(factory);
    }

    update() {
      this.__createRaindropsLayer();

      const markedForDestruct = [];

      for (let i = 0; i < this.drops.length; i++) {
        const drop = this.drops[i];

        if (Date.now() - drop.createdAt >= this.config.raindropTtl) {
          markedForDestruct.push(i);
        } else if (!drop.atRest) {
          for (const factory of this.forceFactories) {
            Raindrop.applyForce(
              drop,
              factory(this.config, {
                location: Vector.copy(drop.location),
                velocity: Vector.copy(drop.velocity),
                mass: drop.mass,
              }),
            );
          }
          Raindrop.update(drop);
        }
      }

      for (const idx of markedForDestruct) {
        this.drops.splice(idx, 1);
      }
    }

    __createRaindropsLayer() {
      for (let i = 0; i < this.config.rainfallIntensity; i++) {
        this.__createRaindrop();
      }
    }

    __createRaindrop() {
      const c = this.config;
      const x = getRandom(-c.offScreenOffset, c.width + c.offScreenOffset);
      // Note(Georgi): Start rainfall off screen so that raindrops can accelerate.
      const y = getRandom(-500, -200);
      const size = getRandom(3, 4);

      this.drops.push(Raindrop.create(x, y, size, this.config));
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
   * @param {RainfallConfig} config
   * @returns HTMLCanvasElement
   */
  function createCanvas(config) {
    const canvas = document.createElement('canvas');
    canvas.className = 'rain-canvas';
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    return canvas;
  }

  /**
   * @param {RainfallConfig} config
   * @param {HTMLCanvasElement} canvas
   */
  function initRainfall(config, canvas) {
    const rain = new Rainfall(config);
    rain.applyForceFactory(gravityForceFactory);
    rain.applyForceFactory(dragForceFactory);

    const ctx = canvas.getContext('2d');

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rain.update();

      ctx.beginPath();
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(141, 190, 203, 0.9)`;

      for (const sf of rain.drops) {
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
   * Attach HTML Canvas to the given element and initialize the rainfall.
   * @param {HTMLElement} el - Host element.
   * @param {RainfallConfig} config - Rainfall configuration object.
   */
  function attachToElement(el, config) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const canvas = createCanvas(cfg);
    el.appendChild(canvas);

    initRainfall(cfg, canvas);
  }

  window.Rain = {
    attachToElement,
  };
})();
