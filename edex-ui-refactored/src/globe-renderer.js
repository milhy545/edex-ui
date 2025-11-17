// eDEX-UI WebGPU Globe Renderer
// Lightweight 3D globe rendering replacing Three.js
// Expected: -85% CPU vs Three.js, ~3-5% CPU usage

const { invoke } = window.__TAURI__.core;

export class GlobeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.device = null;
    this.context = null;
    this.pipeline = null;
    this.wireframePipeline = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.wireframeBuffer = null;
    this.uniformBuffer = null;
    this.bindGroup = null;
    this.geometry = null;
    this.isAnimating = false;
    this.frameCount = 0;
    this.rotation = 0;

    // Camera settings
    this.cameraDistance = 2.5;
    this.cameraPos = [0, 0, this.cameraDistance];

    // Performance settings
    this.targetFPS = 30;
    this.lastFrameTime = 0;
  }

  /**
   * Initialize WebGPU and load globe geometry
   */
  async init() {
    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU not supported in this browser');
      }

      // Request adapter and device
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        throw new Error('Failed to get WebGPU adapter');
      }

      this.device = await adapter.requestDevice();

      // Configure canvas context
      this.context = this.canvas.getContext('webgpu');
      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

      this.context.configure({
        device: this.device,
        format: canvasFormat,
        alphaMode: 'premultiplied',
      });

      // Load globe geometry from Rust
      console.log('Loading globe geometry from Rust...');
      this.geometry = await invoke('get_globe_geometry', {
        subdivisions: 3  // Balance between quality and performance
      });

      console.log(`Globe loaded: ${this.geometry.vertex_count} vertices, ${this.geometry.indices.length / 3} triangles`);

      // Load grid lines for wireframe
      const gridLines = await invoke('get_globe_grid_lines', {
        subdivisions: 2  // Lower subdivision for wireframe
      });

      // Create vertex buffer
      await this.createVertexBuffer();

      // Create index buffer
      await this.createIndexBuffer();

      // Create wireframe buffer
      await this.createWireframeBuffer(gridLines);

      // Create uniform buffer
      await this.createUniformBuffer();

      // Load and create shader module
      const shaderCode = await fetch('/shaders/globe.wgsl').then(r => r.text());
      const shaderModule = this.device.createShaderModule({
        code: shaderCode,
        label: 'Globe Shader',
      });

      // Create render pipeline for solid globe
      await this.createRenderPipeline(shaderModule, canvasFormat);

      // Create wireframe pipeline
      await this.createWireframePipeline(shaderModule, canvasFormat);

      console.log('WebGPU Globe Renderer initialized successfully');
      return true;

    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  /**
   * Create vertex buffer from geometry data
   */
  async createVertexBuffer() {
    // Interleave vertices and normals: [x, y, z, nx, ny, nz, ...]
    const vertexData = new Float32Array(this.geometry.vertex_count * 6);

    for (let i = 0; i < this.geometry.vertex_count; i++) {
      const vOffset = i * 3;
      const offset = i * 6;

      vertexData[offset + 0] = this.geometry.vertices[vOffset + 0];
      vertexData[offset + 1] = this.geometry.vertices[vOffset + 1];
      vertexData[offset + 2] = this.geometry.vertices[vOffset + 2];
      vertexData[offset + 3] = this.geometry.normals[vOffset + 0];
      vertexData[offset + 4] = this.geometry.normals[vOffset + 1];
      vertexData[offset + 5] = this.geometry.normals[vOffset + 2];
    }

    this.vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertexData);
    this.vertexBuffer.unmap();
  }

  /**
   * Create index buffer
   */
  async createIndexBuffer() {
    const indexData = new Uint32Array(this.geometry.indices);

    this.indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX,
      mappedAtCreation: true,
    });

    new Uint32Array(this.indexBuffer.getMappedRange()).set(indexData);
    this.indexBuffer.unmap();
  }

  /**
   * Create wireframe buffer
   */
  async createWireframeBuffer(gridLines) {
    const wireData = new Float32Array(gridLines);

    this.wireframeBuffer = this.device.createBuffer({
      size: wireData.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });

    new Float32Array(this.wireframeBuffer.getMappedRange()).set(wireData);
    this.wireframeBuffer.unmap();
    this.wireframeVertexCount = gridLines.length / 3;
  }

  /**
   * Create uniform buffer for matrices and time
   */
  async createUniformBuffer() {
    // Uniform layout: mat4 view_proj, mat4 model, f32 time, vec3 camera_pos
    const uniformBufferSize = 16 * 4 + 16 * 4 + 4 + 12 + 4; // Padding for alignment

    this.uniformBuffer = this.device.createBuffer({
      size: uniformBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /**
   * Create render pipeline for solid globe
   */
  async createRenderPipeline(shaderModule, format) {
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout({
          entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
          }]
        })
      ]
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 24, // 6 floats * 4 bytes (position + normal)
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },  // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{ format }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back',
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      },
    });

    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this.uniformBuffer }
      }]
    });
  }

  /**
   * Create wireframe render pipeline
   */
  async createWireframePipeline(shaderModule, format) {
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout({
          entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
            buffer: { type: 'uniform' }
          }]
        })
      ]
    });

    this.wireframePipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_wireframe',
        buffers: [{
          arrayStride: 12, // 3 floats * 4 bytes
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_wireframe',
        targets: [{
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            }
          }
        }]
      },
      primitive: {
        topology: 'line-list',
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: 'less-equal',
        format: 'depth24plus',
      },
    });
  }

  /**
   * Create perspective projection matrix
   */
  createPerspectiveMatrix(fov, aspect, near, far) {
    const f = 1.0 / Math.tan(fov / 2);
    const rangeInv = 1.0 / (near - far);

    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * rangeInv, -1,
      0, 0, near * far * rangeInv * 2, 0
    ]);
  }

  /**
   * Create model matrix (rotation)
   */
  createModelMatrix(rotation) {
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);

    return new Float32Array([
      c, 0, s, 0,
      0, 1, 0, 0,
      -s, 0, c, 0,
      0, 0, 0, 1
    ]);
  }

  /**
   * Update uniforms
   */
  updateUniforms(time) {
    const aspect = this.canvas.width / this.canvas.height;
    const projMatrix = this.createPerspectiveMatrix(Math.PI / 4, aspect, 0.1, 100.0);
    const modelMatrix = this.createModelMatrix(this.rotation);

    // Create uniform data
    const uniformData = new Float32Array(16 + 16 + 1 + 3 + 1); // +1 for padding
    uniformData.set(projMatrix, 0);
    uniformData.set(modelMatrix, 16);
    uniformData[32] = time; // time
    uniformData.set(this.cameraPos, 33); // camera_pos

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
  }

  /**
   * Render one frame
   */
  render(currentTime) {
    if (!this.device || !this.pipeline) return;

    // Frame rate limiting
    const elapsed = currentTime - this.lastFrameTime;
    const targetInterval = 1000 / this.targetFPS;

    if (elapsed < targetInterval) return;

    this.lastFrameTime = currentTime;

    // Auto-rotate
    this.rotation += 0.005;

    // Update uniforms
    this.updateUniforms(currentTime / 1000);

    // Create depth texture
    const depthTexture = this.device.createTexture({
      size: [this.canvas.width, this.canvas.height],
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Create command encoder
    const commandEncoder = this.device.createCommandEncoder();

    // Begin render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.04, b: 0.06, a: 1.0 }, // Dark background
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });

    // Render solid globe
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.vertexBuffer);
    renderPass.setIndexBuffer(this.indexBuffer, 'uint32');
    renderPass.drawIndexed(this.geometry.indices.length);

    // Render wireframe
    renderPass.setPipeline(this.wireframePipeline);
    renderPass.setVertexBuffer(0, this.wireframeBuffer);
    renderPass.draw(this.wireframeVertexCount);

    renderPass.end();

    // Submit commands
    this.device.queue.submit([commandEncoder.finish()]);

    this.frameCount++;

    // Continue animation loop
    if (this.isAnimating) {
      requestAnimationFrame((time) => this.render(time));
    }
  }

  /**
   * Start animation
   */
  start() {
    if (this.isAnimating) return;

    this.isAnimating = true;
    this.lastFrameTime = performance.now();
    requestAnimationFrame((time) => this.render(time));
    console.log('Globe animation started (30 FPS target)');
  }

  /**
   * Stop animation
   */
  stop() {
    this.isAnimating = false;
    console.log('Globe animation stopped');
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.stop();

    if (this.vertexBuffer) this.vertexBuffer.destroy();
    if (this.indexBuffer) this.indexBuffer.destroy();
    if (this.wireframeBuffer) this.wireframeBuffer.destroy();
    if (this.uniformBuffer) this.uniformBuffer.destroy();

    this.device = null;
  }
}
