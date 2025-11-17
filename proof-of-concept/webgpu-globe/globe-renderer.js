/**
 * WebGPU Globe Renderer POC
 * Replaces Three.js ENCOM Globe (43,539 lines) with lightweight WebGPU
 *
 * Performance targets:
 * - CPU: <3% idle (vs 15-20% Three.js)
 * - Memory: <50MB (vs 150MB Three.js)
 * - Adaptive FPS: 5-60fps (vs fixed 30fps)
 */

class GlobeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.device = null;
        this.context = null;
        this.pipeline = null;
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.uniformBuffer = null;
        this.themeBuffer = null;
        this.bindGroup = null;

        // Performance settings
        this.targetFPS = 30;
        this.isActive = false; // Mouse over or animating
        this.adaptiveFPS = true;

        // Camera/view settings
        this.rotation = 0;
        this.rotationSpeed = 0.1; // radians per second

        // Geometry data (will be generated or loaded)
        this.vertices = null;
        this.indices = null;
    }

    async init() {
        console.log('🌍 Initializing WebGPU Globe Renderer...');

        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported. Fallback to WebGL2 required.');
        }

        // Get adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        this.device = await adapter.requestDevice();

        // Configure canvas context
        this.context = this.canvas.getContext('webgpu');
        const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: canvasFormat,
            alphaMode: 'premultiplied',
        });

        // Generate geometry
        this.generateGeometry();

        // Create buffers
        await this.createBuffers();

        // Load shader
        await this.createPipeline(canvasFormat);

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ WebGPU Globe initialized');
        console.log(`   Vertices: ${this.vertices.length / 6}`);
        console.log(`   Triangles: ${this.indices.length / 3}`);
    }

    /**
     * Generate icosphere geometry (simplified POC)
     * Production version would load precomputed binary data from Rust
     */
    generateGeometry() {
        console.log('📐 Generating icosphere geometry...');

        // Simplified icosphere generation
        // In production: load from Rust-generated binary file

        const vertices = [];
        const indices = [];

        // Generate UV sphere for POC (production would use proper icosphere)
        const segments = 32;
        const rings = 16;
        const radius = 1.0;

        for (let ring = 0; ring <= rings; ring++) {
            const phi = (ring / rings) * Math.PI;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            for (let seg = 0; seg <= segments; seg++) {
                const theta = (seg / segments) * Math.PI * 2;
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);

                // Position (and normal, since it's a unit sphere)
                const x = radius * sinPhi * cosTheta;
                const y = radius * cosPhi;
                const z = radius * sinPhi * sinTheta;

                vertices.push(
                    x, y, z,      // position
                    x, y, z       // normal (normalized position)
                );
            }
        }

        // Generate indices
        for (let ring = 0; ring < rings; ring++) {
            for (let seg = 0; seg < segments; seg++) {
                const a = ring * (segments + 1) + seg;
                const b = a + segments + 1;

                indices.push(a, b, a + 1);
                indices.push(b, b + 1, a + 1);
            }
        }

        this.vertices = new Float32Array(vertices);
        this.indices = new Uint32Array(indices);

        console.log(`   Generated ${this.vertices.length / 6} vertices, ${this.indices.length / 3} triangles`);
    }

    async createBuffers() {
        // Vertex buffer
        this.vertexBuffer = this.device.createBuffer({
            label: 'Globe vertices',
            size: this.vertices.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.vertexBuffer, 0, this.vertices);

        // Index buffer
        this.indexBuffer = this.device.createBuffer({
            label: 'Globe indices',
            size: this.indices.byteLength,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.indexBuffer, 0, this.indices);

        // Uniform buffer (matrices, time, etc.)
        this.uniformBuffer = this.device.createBuffer({
            label: 'Uniforms',
            size: 256, // Enough for all uniforms
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Theme buffer (colors)
        const themeData = new Float32Array([
            // base_color (tron theme: cyan)
            0.66, 0.81, 0.82, 0.0,
            // glow_color
            0.4, 0.8, 1.0, 0.0,
            // grid_color
            0.2, 0.6, 0.8, 0.0,
            // atmosphere_color
            0.3, 0.7, 1.0, 0.0,
        ]);

        this.themeBuffer = this.device.createBuffer({
            label: 'Theme',
            size: themeData.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.device.queue.writeBuffer(this.themeBuffer, 0, themeData);
    }

    async createPipeline(canvasFormat) {
        // Load shader code
        const shaderCode = await fetch('./globe.wgsl').then(r => r.text());

        const shaderModule = this.device.createShaderModule({
            label: 'Globe shader',
            code: shaderCode,
        });

        // Create pipeline layout
        const bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' },
                },
            ],
        });

        const pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
        });

        // Create render pipeline
        this.pipeline = this.device.createRenderPipeline({
            label: 'Globe pipeline',
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vs_main',
                buffers: [{
                    arrayStride: 24, // 6 floats * 4 bytes
                    attributes: [
                        {
                            // position
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3',
                        },
                        {
                            // normal
                            shaderLocation: 1,
                            offset: 12,
                            format: 'float32x3',
                        },
                    ],
                }],
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fs_main', // or 'fs_simple' for even better performance
                targets: [{
                    format: canvasFormat,
                }],
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
            layout: bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer },
                },
                {
                    binding: 1,
                    resource: { buffer: this.themeBuffer },
                },
            ],
        });

        // Create depth texture
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    /**
     * Update uniforms (matrices, time, etc.)
     */
    updateUniforms(time) {
        // Simple projection matrix (perspective)
        const aspect = this.canvas.width / this.canvas.height;
        const fov = Math.PI / 4;
        const near = 0.1;
        const far = 100.0;

        const f = 1.0 / Math.tan(fov / 2);
        const projMatrix = new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0,
        ]);

        // Simple view matrix (camera at z=3)
        const viewMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, -3, 1,
        ]);

        // Combine view and projection
        const viewProjMatrix = this.multiplyMatrices(projMatrix, viewMatrix);

        // Model matrix (identity for now, rotation handled in shader)
        const modelMatrix = new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1,
        ]);

        // Pack uniforms
        const uniforms = new Float32Array(64); // 256 bytes / 4
        uniforms.set(viewProjMatrix, 0);        // offset 0
        uniforms.set(modelMatrix, 16);          // offset 64
        uniforms.set(modelMatrix, 32);          // normal_matrix (simplified)
        uniforms.set([0, 0, 3], 48);            // camera_pos
        uniforms[51] = time;                    // time
        uniforms[52] = this.rotationSpeed;      // rotation_speed

        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }

    /**
     * Render frame
     */
    render(time) {
        // Update uniforms
        this.updateUniforms(time / 1000); // Convert to seconds

        // Create command encoder
        const encoder = this.device.createCommandEncoder();

        // Render pass
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                clearValue: { r: 0.02, g: 0.02, b: 0.05, a: 1.0 },
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        pass.setPipeline(this.pipeline);
        pass.setVertexBuffer(0, this.vertexBuffer);
        pass.setIndexBuffer(this.indexBuffer, 'uint32');
        pass.setBindGroup(0, this.bindGroup);
        pass.drawIndexed(this.indices.length);
        pass.end();

        this.device.queue.submit([encoder.finish()]);
    }

    /**
     * Animation loop with adaptive FPS
     */
    startRendering() {
        const loop = (time) => {
            this.render(time);

            // Adaptive FPS
            const frameInterval = 1000 / this.targetFPS;

            if (this.adaptiveFPS) {
                // Adjust FPS based on activity
                if (this.isActive) {
                    this.targetFPS = 60; // Smooth animation when active
                } else {
                    this.targetFPS = 15; // Lower FPS when idle
                }
            }

            setTimeout(() => {
                requestAnimationFrame(loop);
            }, frameInterval);
        };

        requestAnimationFrame(loop);
    }

    setupEventListeners() {
        // Detect mouse activity
        this.canvas.addEventListener('mouseenter', () => {
            this.isActive = true;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isActive = false;
        });

        // Detect tab visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.targetFPS = 1; // Minimal FPS when tab hidden
            } else {
                this.targetFPS = 15; // Resume
            }
        });
    }

    /**
     * Helper: multiply 4x4 matrices
     */
    multiplyMatrices(a, b) {
        const result = new Float32Array(16);

        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                let sum = 0;
                for (let k = 0; k < 4; k++) {
                    sum += a[row * 4 + k] * b[k * 4 + col];
                }
                result[row * 4 + col] = sum;
            }
        }

        return result;
    }
}

// Usage example
async function initGlobe() {
    const canvas = document.getElementById('globe-canvas');
    const renderer = new GlobeRenderer(canvas);

    try {
        await renderer.init();
        renderer.startRendering();

        console.log('🌍 Globe rendering at adaptive FPS');
        console.log('   Hover over globe: 60 FPS');
        console.log('   Idle: 15 FPS');
        console.log('   Tab hidden: 1 FPS');
    } catch (error) {
        console.error('Failed to initialize WebGPU globe:', error);
        console.log('Fallback to WebGL2 or Canvas required');
    }
}

// Auto-init when module loaded
if (typeof window !== 'undefined') {
    window.GlobeRenderer = GlobeRenderer;
    window.initGlobe = initGlobe;
}

export { GlobeRenderer, initGlobe };
