import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLiquidRenderer, type LiquidRenderer } from './createLiquidRenderer'
import { LiquidCanvas } from './LiquidCanvas'

vi.mock('./createLiquidRenderer', () => ({ createLiquidRenderer: vi.fn() }))

const mockedCreateRenderer = vi.mocked(createLiquidRenderer)

function fakeRenderer(): LiquidRenderer {
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

beforeEach(() => {
  mockedCreateRenderer.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LiquidCanvas', () => {
  it('is decorative and hidden from assistive technology', () => {
    stubMotionPreference(false)
    mockedCreateRenderer.mockReturnValue(fakeRenderer())

    const { container } = render(<LiquidCanvas />)

    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
  })

  it('falls back to the static hero when WebGL is unavailable', () => {
    stubMotionPreference(true)
    mockedCreateRenderer.mockReturnValue(null)

    const { container } = render(<LiquidCanvas />)

    expect(container.querySelector('canvas')).toHaveAttribute('data-state', 'fallback')
  })

  it('draws a single still frame without an animation loop when motion is reduced', () => {
    stubMotionPreference(false)
    const renderer = fakeRenderer()
    mockedCreateRenderer.mockReturnValue(renderer)
    const requestFrame = vi.fn()
    vi.stubGlobal('requestAnimationFrame', requestFrame)

    const { container } = render(<LiquidCanvas />)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(requestFrame).not.toHaveBeenCalled()
    expect(container.querySelector('canvas')).toHaveAttribute('data-state', 'ready')
  })

  it('animates when motion is allowed', () => {
    stubMotionPreference(true)
    const renderer = fakeRenderer()
    mockedCreateRenderer.mockReturnValue(renderer)
    const queued: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queued.push(callback)
      return queued.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())

    const { container } = render(<LiquidCanvas />)
    queued.shift()?.(performance.now() + 16)
    queued.shift()?.(performance.now() + 32)

    expect(renderer.render).toHaveBeenCalledTimes(2)
    expect(container.querySelector('canvas')).toHaveAttribute('data-state', 'ready')
  })

  it('holds the dive at zero until asked, then follows the clock up to fully inside', () => {
    stubMotionPreference(true)
    const renderer = fakeRenderer()
    mockedCreateRenderer.mockReturnValue(renderer)
    const queued: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      queued.push(callback)
      return queued.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const start = performance.now()
    const diveOfFrame = (index: number) => vi.mocked(renderer.render).mock.calls[index]?.[0].dive

    const { rerender } = render(<LiquidCanvas />)
    queued.shift()?.(start + 16)
    rerender(<LiquidCanvas diving />)
    queued.shift()?.(start + 48)
    queued.shift()?.(start + 400)
    queued.shift()?.(start + 800)
    queued.shift()?.(start + 60_000)

    expect(diveOfFrame(0)).toBe(0)
    expect(diveOfFrame(2)).toBeGreaterThan(0)
    expect(diveOfFrame(3)).toBeGreaterThan(diveOfFrame(2) ?? 1)
    expect(diveOfFrame(4)).toBe(1)
  })

  it('releases the WebGL resources on unmount', () => {
    stubMotionPreference(false)
    const renderer = fakeRenderer()
    mockedCreateRenderer.mockReturnValue(renderer)

    const { unmount } = render(<LiquidCanvas />)
    unmount()

    expect(renderer.dispose).toHaveBeenCalledTimes(1)
  })
})
