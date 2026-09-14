import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { IridescentHero } from './IridescentHero'

function stubMotionPreference(allowsMotion: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: allowsMotion,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function runFramesSynchronously() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(performance.now())
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

function movePointer(clientX: number, clientY: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX, clientY }))
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('IridescentHero', () => {
  it('keeps the letter-split wordmark out of the accessibility tree', () => {
    stubMotionPreference(false)
    const { container } = render(<IridescentHero />)

    const wordmark = container.querySelector('[data-wordmark]')
    expect(wordmark).toHaveAttribute('aria-hidden', 'true')
    expect(wordmark).toHaveTextContent('Aletheia')
  })

  it('hides the rotating badge from assistive technology', () => {
    stubMotionPreference(false)
    const { container } = render(<IridescentHero />)

    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('moves the light toward the pointer when motion is allowed', () => {
    stubMotionPreference(true)
    runFramesSynchronously()
    const { container } = render(<IridescentHero />)
    const hero = container.firstElementChild as HTMLElement

    movePointer(120, 60)

    expect(parseFloat(hero.style.getPropertyValue('--glow-x'))).toBeCloseTo(120, 0)
    expect(parseFloat(hero.style.getPropertyValue('--glow-y'))).toBeCloseTo(60, 0)
  })

  it('stays still when the user prefers reduced motion', () => {
    stubMotionPreference(false)
    runFramesSynchronously()
    const { container } = render(<IridescentHero />)
    const hero = container.firstElementChild as HTMLElement

    movePointer(120, 60)

    expect(hero.style.getPropertyValue('--glow-x')).toBe('')
  })
})
