// WebGPU Globe Shader - Simplified POC
// Replaces 43,539 lines of Three.js with ~200 lines of WGSL

// Vertex Input
struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) normal: vec3<f32>,
}

// Vertex Output
struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) world_position: vec3<f32>,
    @location(1) world_normal: vec3<f32>,
    @location(2) view_dir: vec3<f32>,
}

// Uniforms
struct Uniforms {
    view_proj: mat4x4<f32>,
    model: mat4x4<f32>,
    normal_matrix: mat4x4<f32>,
    camera_pos: vec3<f32>,
    time: f32,
    rotation_speed: f32,
    _padding: vec2<f32>,
}

@group(0) @binding(0)
var<uniform> uniforms: Uniforms;

// Theme colors
struct Theme {
    base_color: vec3<f32>,
    glow_color: vec3<f32>,
    grid_color: vec3<f32>,
    atmosphere_color: vec3<f32>,
}

@group(0) @binding(1)
var<uniform> theme: Theme;

// ============================================================================
// VERTEX SHADER
// ============================================================================

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    // Apply rotation over time
    let rotation = mat4x4<f32>(
        vec4<f32>(cos(uniforms.time * uniforms.rotation_speed), 0.0, sin(uniforms.time * uniforms.rotation_speed), 0.0),
        vec4<f32>(0.0, 1.0, 0.0, 0.0),
        vec4<f32>(-sin(uniforms.time * uniforms.rotation_speed), 0.0, cos(uniforms.time * uniforms.rotation_speed), 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );

    let model = uniforms.model * rotation;

    // Transform position
    let world_pos = model * vec4<f32>(in.position, 1.0);
    out.clip_position = uniforms.view_proj * world_pos;
    out.world_position = world_pos.xyz;

    // Transform normal
    out.world_normal = normalize((uniforms.normal_matrix * vec4<f32>(in.normal, 0.0)).xyz);

    // View direction
    out.view_dir = normalize(uniforms.camera_pos - world_pos.xyz);

    return out;
}

// ============================================================================
// FRAGMENT SHADER
// ============================================================================

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);

    // Light direction (fixed)
    let light_dir = normalize(vec3<f32>(1.0, 1.0, 1.0));

    // === Basic Lighting ===

    // Diffuse
    let n_dot_l = max(dot(normal, light_dir), 0.0);
    let diffuse = theme.base_color * n_dot_l * 0.7;

    // Ambient
    let ambient = theme.base_color * 0.3;

    // === Atmosphere Glow ===

    // Fresnel effect
    let n_dot_v = max(dot(normal, view_dir), 0.0);
    let fresnel = pow(1.0 - n_dot_v, 3.0);

    let atmosphere = theme.atmosphere_color * fresnel * 0.5;

    // === Hexagonal Grid (simplified) ===

    // Procedural grid based on world position
    let grid_scale = 10.0;
    let grid_pos = in.world_position * grid_scale;

    // Hexagonal grid approximation
    let hex_x = abs(fract(grid_pos.x) - 0.5);
    let hex_y = abs(fract(grid_pos.y) - 0.5);
    let hex_z = abs(fract(grid_pos.z) - 0.5);

    let grid_intensity = smoothstep(0.48, 0.5, max(max(hex_x, hex_y), hex_z));
    let grid = theme.grid_color * grid_intensity * 0.3;

    // === Combine ===

    var final_color = ambient + diffuse + atmosphere + grid;

    // Boost glow on edges
    final_color += theme.glow_color * fresnel * 0.2;

    return vec4<f32>(final_color, 1.0);
}

// ============================================================================
// ALTERNATIVE: Simplified Fragment Shader (even faster)
// ============================================================================

@fragment
fn fs_simple(in: VertexOutput) -> @location(0) vec4<f32> {
    let normal = normalize(in.world_normal);
    let view_dir = normalize(in.view_dir);

    // Single light calculation
    let light_dir = normalize(vec3<f32>(1.0, 1.0, 1.0));
    let lighting = max(dot(normal, light_dir), 0.3);

    // Rim light
    let rim = pow(1.0 - max(dot(normal, view_dir), 0.0), 2.0);

    let color = theme.base_color * lighting + theme.glow_color * rim * 0.5;

    return vec4<f32>(color, 1.0);
}
