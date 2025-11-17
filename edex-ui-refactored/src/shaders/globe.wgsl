// eDEX-UI Globe Shader (WebGPU / WGSL)
// TRON-inspired sci-fi globe rendering
// Replaces Three.js with lightweight WebGPU

// ============================================================================
// Structures
// ============================================================================

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_normal: vec3<f32>,
    @location(1) world_position: vec3<f32>,
}

struct Uniforms {
    view_proj: mat4x4<f32>,
    model: mat4x4<f32>,
    time: f32,
    camera_pos: vec3<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// ============================================================================
// Vertex Shader
// ============================================================================

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Transform position to world space
    let world_pos = uniforms.model * vec4<f32>(in.position, 1.0);

    // Transform to clip space
    out.clip_position = uniforms.view_proj * world_pos;

    // Pass world position and normal
    out.world_position = world_pos.xyz;
    out.world_normal = (uniforms.model * vec4<f32>(in.normal, 0.0)).xyz;

    return out;
}

// ============================================================================
// Fragment Shader - TRON Theme
// ============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(uniforms.camera_pos - in.world_position);

    // Light direction (slightly above and to the right)
    let light_dir = normalize(vec3<f32>(0.5, 1.0, 0.3));

    // Diffuse lighting
    let diffuse = max(dot(normal, light_dir), 0.0);

    // Rim lighting (fresnel effect)
    let rim = 1.0 - max(dot(view_dir, normal), 0.0);
    let rim_intensity = pow(rim, 2.5);

    // Atmosphere glow (stronger rim)
    let atmosphere = pow(rim, 3.0) * 0.6;

    // Scanline effect (subtle horizontal lines)
    let scanline_freq = 40.0;
    let scanline = sin(in.world_position.y * scanline_freq + uniforms.time * 2.0) * 0.5 + 0.5;
    let scanline_effect = mix(0.9, 1.0, scanline * 0.3);

    // TRON colors
    let base_color = vec3<f32>(0.05, 0.13, 0.18);        // Dark blue-teal background
    let glow_color = vec3<f32>(0.42, 0.76, 0.84);        // Cyan glow (#6ac3d5)
    let rim_color = vec3<f32>(0.67, 0.81, 0.82);         // Light cyan (#aacfd1)

    // Combine lighting
    var final_color = base_color * diffuse * 0.5;        // Dim diffuse
    final_color += glow_color * atmosphere;              // Atmosphere glow
    final_color += rim_color * rim_intensity * 0.4;      // Rim highlight
    final_color *= scanline_effect;                      // Scanlines

    // Slight pulse effect
    let pulse = sin(uniforms.time * 0.8) * 0.1 + 0.9;
    final_color *= pulse;

    return vec4<f32>(final_color, 1.0);
}

// ============================================================================
// Wireframe/Grid Shader
// ============================================================================

struct WireframeInput {
    @location(0) position: vec3<f32>,
}

struct WireframeOutput {
    @builtin(position) clip_position: vec4<f32>,
}

@vertex
fn vs_wireframe(in: WireframeInput) -> WireframeOutput {
    var out: WireframeOutput;

    let world_pos = uniforms.model * vec4<f32>(in.position, 1.0);
    out.clip_position = uniforms.view_proj * world_pos;

    return out;
}

@fragment
fn fs_wireframe() -> @location(0) vec4<f32> {
    // Glowing cyan lines
    let wire_color = vec3<f32>(0.42, 0.76, 0.84);  // #6ac3d5

    // Pulse effect on grid
    let pulse = sin(uniforms.time * 1.2) * 0.2 + 0.8;

    return vec4<f32>(wire_color * pulse, 0.7);
}
