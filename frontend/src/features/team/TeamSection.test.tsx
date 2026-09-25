import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMeerkatScene, type MeerkatScene } from './scene/createMeerkatScene'
import { SLOT_COUNT } from './scene/meerkatShaders'
import { TEAM_MEMBERS } from './teamMembers'
import { TeamSection } from './TeamSection'

vi.mock('./scene/createMeerkatScene', () => ({ createMeerkatScene: vi.fn() }))

const mockedCreateScene = vi.mocked(createMeerkatScene)

function fakeScene(): MeerkatScene {
  return {
    resize: vi.fn(),
    setSlots: vi.fn(),
    setStirred: vi.fn(),
    setPaused: vi.fn(),
    dispose: vi.fn(),
  }
}

beforeEach(() => {
  mockedCreateScene.mockReset()
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TeamSection', () => {
  it('has a meerkat slot in the simulation for every member', () => {
    // The particles are split into SLOT_COUNT meerkats; a member past that would have none.
    expect(TEAM_MEMBERS).toHaveLength(SLOT_COUNT)
  })

  it('lists the four members on one team list, each with their track', () => {
    mockedCreateScene.mockReturnValue(fakeScene())

    render(<TeamSection />)

    const list = screen.getByRole('list', { name: 'Team members' })
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    TEAM_MEMBERS.forEach((member, index) => {
      const item = items[index]
      if (!item) throw new Error(`missing list item ${index}`)
      expect(within(item).getByText(member.name)).toBeInTheDocument()
      expect(within(item).getByText(member.track)).toBeInTheDocument()
    })
  })

  it('links every member to their GitHub profile', () => {
    mockedCreateScene.mockReturnValue(fakeScene())

    render(<TeamSection />)

    for (const member of TEAM_MEMBERS) {
      const link = screen.getByRole('link', {
        name: `@${member.handle} on GitHub, opens in a new tab`,
      })
      expect(link).toHaveAttribute('href', `https://github.com/${member.handle}`)
      expect(link).toHaveAttribute('target', '_blank')
    }
  })
  it('names the section for assistive technology and hides the canvas from it', () => {
    mockedCreateScene.mockReturnValue(fakeScene())

    const { container } = render(<TeamSection />)

    expect(screen.getByRole('region', { name: 'Team' })).toBeInTheDocument()
    expect(container.querySelector('canvas')).toHaveAttribute('aria-hidden', 'true')
  })

  it('stirs the meerkat of the member under the pointer or in focus', async () => {
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)
    const user = userEvent.setup()

    render(<TeamSection />)
    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalled())

    const [, second] = screen.getAllByRole('listitem')
    if (!second) throw new Error('missing second member')
    await user.hover(second)
    await waitFor(() => expect(scene.setStirred).toHaveBeenLastCalledWith(1))

    await user.unhover(second)
    await waitFor(() => expect(scene.setStirred).toHaveBeenLastCalledWith(null))

    await user.tab()
    await waitFor(() => expect(scene.setStirred).toHaveBeenLastCalledWith(0))
  })

  it('keeps the members and marks the scene as fallback when WebGL is unavailable', async () => {
    mockedCreateScene.mockReturnValue(null)

    const { container } = render(<TeamSection />)

    await waitFor(() =>
      expect(container.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'fallback'),
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('pauses the scene while the page behind it is covered', async () => {
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { rerender } = render(<TeamSection paused={false} />)
    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalled())

    rerender(<TeamSection paused />)

    await waitFor(() => expect(scene.setPaused).toHaveBeenLastCalledWith(true))
  })

  it('releases the scene when it unmounts', async () => {
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { unmount } = render(<TeamSection />)
    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalled())
    unmount()

    expect(scene.dispose).toHaveBeenCalledTimes(1)
  })
})
