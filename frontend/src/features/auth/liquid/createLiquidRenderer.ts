import { FRAGMENT_SHADER, VERTEX_SHADER } from './liquidShader'

export interface LiquidFrame {
  time: number
  pointerX: number
  pointerY: number
  reveal: number
  /** Lens center in canvas UV space (0..1, origin bottom-left). */
  lensX: number
  lensY: number
  /** Linear 0..1 progress of the trip through the lens; the shader shapes the pacing. */
  dive: number
}

export interface LiquidRenderer {
  resize: (width: number, height: number, pixelRatio: number) => void
  render: (frame: LiquidFrame) => void
  dispose: () => void
}

// One oversized triangle covers the whole viewport with fewer vertices than a quad.
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3])

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Liquid hero shader failed to compile:', gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null

  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Liquid hero program failed to link:', gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }
  return program
}

export function createLiquidRenderer(canvas: HTMLCanvasElement): LiquidRenderer | null {
  if (typeof WebGLRenderingContext === 'undefined') return null

  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null

  const program = createProgram(gl)
  const buffer = gl.createBuffer()
  if (!program || !buffer) return null

  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW)
  const position = gl.getAttribLocation(program, 'aPosition')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const uniforms = {
    resolution: gl.getUniformLocation(program, 'uResolution'),
    time: gl.getUniformLocation(program, 'uTime'),
    pointer: gl.getUniformLocation(program, 'uPointer'),
    reveal: gl.getUniformLocation(program, 'uReveal'),
    lensCenter: gl.getUniformLocation(program, 'uLensCenter'),
    dive: gl.getUniformLocation(program, 'uDive'),
  }

  return {
    resize(width, height, pixelRatio) {
      const pixelWidth = Math.max(1, Math.round(width * pixelRatio))
      const pixelHeight = Math.max(1, Math.round(height * pixelRatio))
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }
      gl.viewport(0, 0, pixelWidth, pixelHeight)
      gl.uniform2f(uniforms.resolution, pixelWidth, pixelHeight)
    },
    render({ time, pointerX, pointerY, reveal, lensX, lensY, dive }) {
      gl.uniform1f(uniforms.time, time)
      gl.uniform2f(uniforms.pointer, pointerX, pointerY)
      gl.uniform1f(uniforms.reveal, reveal)
      gl.uniform2f(uniforms.lensCenter, lensX, lensY)
      gl.uniform1f(uniforms.dive, dive)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    // Deliberately not calling WEBGL_lose_context: React StrictMode remounts onto the same
    // canvas element, and a lost context cannot be recovered for it.
    dispose() {
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}
