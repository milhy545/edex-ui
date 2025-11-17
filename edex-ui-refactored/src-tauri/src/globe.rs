// 3D Globe Geometry Generation for eDEX-UI
// Replaces Three.js ENCOM globe with lightweight Rust-generated geometry
// Generates hexasphere/icosphere geometry for WebGPU rendering

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GlobeGeometry {
    pub vertices: Vec<f32>,    // Flat array: [x, y, z, x, y, z, ...]
    pub normals: Vec<f32>,     // Flat array: [nx, ny, nz, nx, ny, nz, ...]
    pub indices: Vec<u32>,     // Triangle indices
    pub vertex_count: usize,
}

/// Generate icosphere/hexasphere geometry
/// Based on subdividing an icosahedron
pub fn generate_hexasphere(subdivisions: u8) -> GlobeGeometry {
    // Golden ratio for icosahedron
    let phi = (1.0 + 5.0_f32.sqrt()) / 2.0;
    let a = 1.0;
    let b = phi;

    // 12 vertices of icosahedron (unit sphere)
    let mut vertices: Vec<[f32; 3]> = vec![
        [-a, b, 0.0], [a, b, 0.0], [-a, -b, 0.0], [a, -b, 0.0],
        [0.0, -a, b], [0.0, a, b], [0.0, -a, -b], [0.0, a, -b],
        [b, 0.0, -a], [b, 0.0, a], [-b, 0.0, -a], [-b, 0.0, a],
    ];

    // Normalize to unit sphere
    for v in &mut vertices {
        let len = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt();
        v[0] /= len;
        v[1] /= len;
        v[2] /= len;
    }

    // 20 faces of icosahedron (counter-clockwise winding)
    let mut indices: Vec<[usize; 3]> = vec![
        [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
        [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
        [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
        [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    // Subdivide
    for _ in 0..subdivisions {
        let (new_vertices, new_indices) = subdivide(&vertices, &indices);
        vertices = new_vertices;
        indices = new_indices;
    }

    // Flatten vertices and calculate normals
    let mut vertex_data = Vec::with_capacity(vertices.len() * 3);
    let mut normal_data = Vec::with_capacity(vertices.len() * 3);

    for v in &vertices {
        vertex_data.push(v[0]);
        vertex_data.push(v[1]);
        vertex_data.push(v[2]);

        // For a sphere, normals are the same as normalized positions
        normal_data.push(v[0]);
        normal_data.push(v[1]);
        normal_data.push(v[2]);
    }

    // Flatten indices
    let index_data: Vec<u32> = indices
        .iter()
        .flat_map(|tri| vec![tri[0] as u32, tri[1] as u32, tri[2] as u32])
        .collect();

    GlobeGeometry {
        vertices: vertex_data,
        normals: normal_data,
        indices: index_data,
        vertex_count: vertices.len(),
    }
}

/// Subdivide mesh by splitting each triangle into 4 smaller triangles
fn subdivide(
    vertices: &Vec<[f32; 3]>,
    indices: &Vec<[usize; 3]>,
) -> (Vec<[f32; 3]>, Vec<[usize; 3]>) {
    let mut new_vertices = vertices.clone();
    let mut new_indices = Vec::new();
    let mut midpoint_cache: HashMap<(usize, usize), usize> = HashMap::new();

    for tri in indices {
        let [a, b, c] = *tri;

        // Get or create midpoints
        let ab = get_midpoint(&mut new_vertices, &mut midpoint_cache, a, b);
        let bc = get_midpoint(&mut new_vertices, &mut midpoint_cache, b, c);
        let ca = get_midpoint(&mut new_vertices, &mut midpoint_cache, c, a);

        // Create 4 new triangles
        new_indices.push([a, ab, ca]);
        new_indices.push([b, bc, ab]);
        new_indices.push([c, ca, bc]);
        new_indices.push([ab, bc, ca]);
    }

    (new_vertices, new_indices)
}

/// Get midpoint between two vertices, creating it if necessary
fn get_midpoint(
    vertices: &mut Vec<[f32; 3]>,
    cache: &mut HashMap<(usize, usize), usize>,
    a: usize,
    b: usize,
) -> usize {
    let key = if a < b { (a, b) } else { (b, a) };

    if let Some(&index) = cache.get(&key) {
        return index;
    }

    let v1 = vertices[a];
    let v2 = vertices[b];

    // Calculate midpoint
    let mid = [
        (v1[0] + v2[0]) * 0.5,
        (v1[1] + v2[1]) * 0.5,
        (v1[2] + v2[2]) * 0.5,
    ];

    // Normalize to unit sphere
    let len = (mid[0] * mid[0] + mid[1] * mid[1] + mid[2] * mid[2]).sqrt();
    let normalized = [mid[0] / len, mid[1] / len, mid[2] / len];

    let index = vertices.len();
    vertices.push(normalized);
    cache.insert(key, index);
    index
}

/// Generate grid lines for TRON-style wireframe
pub fn generate_grid_lines(subdivisions: u8) -> Vec<f32> {
    let geometry = generate_hexasphere(subdivisions);
    let mut lines = Vec::new();

    // Generate lines from triangle edges
    for i in (0..geometry.indices.len()).step_by(3) {
        let i0 = geometry.indices[i] as usize * 3;
        let i1 = geometry.indices[i + 1] as usize * 3;
        let i2 = geometry.indices[i + 2] as usize * 3;

        // Triangle edges: a-b, b-c, c-a
        lines.extend_from_slice(&[
            geometry.vertices[i0], geometry.vertices[i0 + 1], geometry.vertices[i0 + 2],
            geometry.vertices[i1], geometry.vertices[i1 + 1], geometry.vertices[i1 + 2],
        ]);
        lines.extend_from_slice(&[
            geometry.vertices[i1], geometry.vertices[i1 + 1], geometry.vertices[i1 + 2],
            geometry.vertices[i2], geometry.vertices[i2 + 1], geometry.vertices[i2 + 2],
        ]);
        lines.extend_from_slice(&[
            geometry.vertices[i2], geometry.vertices[i2 + 1], geometry.vertices[i2 + 2],
            geometry.vertices[i0], geometry.vertices[i0 + 1], geometry.vertices[i0 + 2],
        ]);
    }

    lines
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_icosahedron_base() {
        let geom = generate_hexasphere(0);
        assert_eq!(geom.vertex_count, 12); // Icosahedron has 12 vertices
        assert_eq!(geom.indices.len(), 60); // 20 faces * 3 indices
    }

    #[test]
    fn test_subdivision() {
        let geom0 = generate_hexasphere(0);
        let geom1 = generate_hexasphere(1);

        // Each subdivision roughly 4x the triangles
        assert!(geom1.indices.len() > geom0.indices.len() * 3);
        assert!(geom1.vertex_count > geom0.vertex_count);
    }

    #[test]
    fn test_vertices_on_unit_sphere() {
        let geom = generate_hexasphere(2);

        // Check that all vertices are on unit sphere (distance from origin = 1)
        for i in (0..geom.vertices.len()).step_by(3) {
            let x = geom.vertices[i];
            let y = geom.vertices[i + 1];
            let z = geom.vertices[i + 2];
            let dist = (x * x + y * y + z * z).sqrt();
            assert!((dist - 1.0).abs() < 0.0001, "Vertex not on unit sphere");
        }
    }

    #[test]
    fn test_grid_lines() {
        let lines = generate_grid_lines(0);
        assert!(lines.len() > 0);
        assert_eq!(lines.len() % 6, 0); // Each line is 2 vertices * 3 components
    }
}
