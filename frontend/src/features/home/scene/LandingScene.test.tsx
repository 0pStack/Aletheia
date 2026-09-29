import { fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLandingScene, type LandingScene as Scene } from './createLandingScene'
import { LandingScene } from './LandingScene'

vi.mock('./createLandingScene', () => ({ createLandingScene: vi.fn() }))

const mockedCreateScene = vi.mocked(createLandingScene)

type SceneOptions = Parameters<typeof createLandingScene>[1]

function fakeScene(): Scene {
  return { resize: vi.fn(), render: vi.fn(), dispose: vi.fn() }
}

function stubMotionPreference(allowsMotion: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: allowsMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function stubFrames() {
  const queued: FrameRequestCallback[] = []
  const cancel = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.push(callback)
    return queued.length
  })
  vi.stubGlobal('cancelAnimationFrame', cancel)
  return { queued, cancel }
}

function sceneOptions(): SceneOptions {
  const options = mockedCreateScene.mock.calls[0]?.[1]
  if (!options) throw new Error('createLandingScene was not called')
  return options
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
}

function setScrollY(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true })
}

function renderScene(ui = <LandingScene />) {
  const view = render(ui)
  const canvas = view.container.querySelector('canvas')
  if (!canvas) throw new Error('no canvas')
  return { ...view, canvas }
}

beforeEach(() => {
  mockedCreateScene.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  setHidden(false)
  setScrollY(0)
})

describe('LandingScene', () => {
  it('falls back when WebGL is unavailable', () => {
    stubMotionPreference(true)
    mockedCreateScene.mockReturnValue(null)

    const { canvas } = renderScene(<LandingScene className="extra" />)

    expect(canvas).toHaveAttribute('data-state', 'fallback')
    expect(canvas.className).toContain('extra')
  })

  it('falls back when the scene files fail to load', () => {
    stubMotionPreference(true)
    mockedCreateScene.mockReturnValue(fakeScene())

    const { canvas } = renderScene()
    sceneOptions().onError()

    expect(canvas).toHaveAttribute('data-state', 'fallback')
  })

  it('draws one still frame, and again on resize, when motion is reduced', () => {
    stubMotionPreference(false)
    const { queued } = stubFrames()
    const observers: ResizeObserverCallback[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          observers.push(callback)
        }
        observe() {}
        disconnect() {}
      },
    )
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { canvas } = renderScene()
    sceneOptions().onReady()
    observers[0]?.([], {} as ResizeObserver)

    expect(canvas).toHaveAttribute('data-state', 'ready')
    expect(scene.render).toHaveBeenCalledTimes(2)
    expect(scene.resize).toHaveBeenCalledTimes(2)
    expect(queued).toHaveLength(0)
  })

  it('animates once ready and follows a mouse, but not a finger', () => {
    stubMotionPreference(true)
    const { queued } = stubFrames()
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)
    const lastFrame = () => vi.mocked(scene.render).mock.lastCall?.[0]

    renderScene()
    sceneOptions().onReady()
    fireEvent.pointerMove(window, { clientX: 1024, clientY: 0, pointerType: 'mouse' })
    queued.shift()?.(performance.now() + 16)

    expect(lastFrame()?.hover).toEqual({ x: expect.any(Number), y: expect.any(Number) })
    expect(lastFrame()?.pointerX).toBeGreaterThan(0)

    fireEvent.pointerMove(window, { clientX: 10, clientY: 10, pointerType: 'touch' })
    queued.shift()?.(performance.now() + 32)
    expect(lastFrame()?.hover).toBeNull()

    fireEvent.pointerMove(window, { clientX: 10, clientY: 10, pointerType: 'mouse' })
    fireEvent.pointerLeave(document.documentElement)
    queued.shift()?.(performance.now() + 48)
    expect(lastFrame()?.hover).toBeNull()
  })

  it('numbers the strongest tags and links the first ones', () => {
    stubMotionPreference(true)
    mockedCreateScene.mockReturnValue(fakeScene())

    const { container } = renderScene()
    sceneOptions().onTags([
      { id: 3, x: 10, y: 20, strength: 0.4 },
      { id: 12, x: 30, y: 40, strength: 0.9 },
    ])

    const slots = container.querySelectorAll<HTMLElement>('[data-tag]')
    expect(slots[0]).toHaveTextContent('12')
    expect(slots[1]).toHaveTextContent('03')
    expect(slots[2]?.style.opacity).toBe('0')
    expect(container.querySelector('polyline')).toHaveAttribute('points', '30,40 10,20')
  })

  it('stops while the tab is hidden, the prop pauses it, or the context is lost', () => {
    stubMotionPreference(true)
    const { queued, cancel } = stubFrames()
    mockedCreateScene.mockReturnValue(fakeScene())

    const { canvas, rerender } = renderScene()
    sceneOptions().onReady()
    expect(queued).toHaveLength(1)

    setHidden(true)
    fireEvent(document, new Event('visibilitychange'))
    expect(cancel).toHaveBeenCalledTimes(1)
    setHidden(false)
    fireEvent(document, new Event('visibilitychange'))
    expect(queued).toHaveLength(2)

    rerender(<LandingScene paused />)
    expect(cancel).toHaveBeenCalledTimes(2)
    fireEvent.scroll(window)
    expect(queued).toHaveLength(2)
    rerender(<LandingScene paused={false} />)
    expect(queued).toHaveLength(3)

    fireEvent(canvas, new Event('webglcontextlost', { cancelable: true }))
    expect(canvas).toHaveAttribute('data-state', 'fallback')
  })

  it('holds a frame once the first screen has scrolled away and the camera has settled', () => {
    stubMotionPreference(true)
    const { queued } = stubFrames()
    mockedCreateScene.mockReturnValue(fakeScene())

    renderScene()
    sceneOptions().onReady()
    setScrollY(window.innerHeight)
    const start = performance.now()
    for (let frame = 1; frame <= 200 && queued.length > 0; frame++) {
      queued.shift()?.(start + frame * 16)
    }

    expect(queued).toHaveLength(0)
  })

  it('withdraws from the lens after the dive, and a key skips the rest of it', () => {
    stubMotionPreference(true)
    const { queued } = stubFrames()
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)
    const arrivals = () => vi.mocked(scene.render).mock.calls.map(([frame]) => frame.arrival)

    render(
      <div data-settle-in="true">
        <LandingScene />
      </div>,
    )
    sceneOptions().onReady()
    const start = performance.now()
    queued.shift()?.(start)
    queued.shift()?.(start + 200)
    fireEvent.keyDown(window, { key: 'Escape' })
    queued.shift()?.(start + 216)

    expect(arrivals()[0]).toBe(0)
    expect(arrivals()[1]).toBeGreaterThan(0)
    expect(arrivals()[1]).toBeLessThan(1)
    expect(arrivals()[2]).toBe(1)
  })

  it('releases the scene on unmount', () => {
    stubMotionPreference(true)
    stubFrames()
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { unmount } = renderScene()
    unmount()

    expect(scene.dispose).toHaveBeenCalledTimes(1)
  })
})
