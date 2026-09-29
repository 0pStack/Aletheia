import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PatientSummary } from '../../../api/schemas'
import { createInventoryScene, type InventoryScene } from './createInventoryScene'
import { PatientInventory } from './PatientInventory'

vi.mock('./createInventoryScene', () => ({ createInventoryScene: vi.fn() }))

const mockedCreateScene = vi.mocked(createInventoryScene)

const patients: PatientSummary[] = [
  { id: 1, name: 'Anna Lindqvist', personalNumber: '19800101-1234' },
  { id: 2, name: 'Erik Berg', personalNumber: '19750505-5678' },
]

function fakeScene(): InventoryScene {
  return { resize: vi.fn(), setSlots: vi.fn(), setHovered: vi.fn(), dispose: vi.fn() }
}

function sceneOptions() {
  const options = mockedCreateScene.mock.calls[0]?.[1]
  if (!options) throw new Error('createInventoryScene was not called')
  return options
}

function renderInventory() {
  const view = render(
    <MemoryRouter>
      <PatientInventory patients={patients} />
    </MemoryRouter>,
  )
  const wrapper = view.container.firstElementChild
  if (!wrapper) throw new Error('no wrapper')
  return { ...view, wrapper }
}

beforeEach(() => {
  mockedCreateScene.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('PatientInventory', () => {
  it('links every patient with initials standing in for the block', () => {
    mockedCreateScene.mockReturnValue(fakeScene())

    renderInventory()

    const link = screen.getByRole('link', { name: /Anna Lindqvist/ })
    expect(link).toHaveAttribute('href', '/patients/1')
    expect(link).toHaveTextContent('AL')
    expect(screen.getByRole('link', { name: /Erik Berg/ })).toHaveTextContent('19750505-5678')
  })

  it('hands the scene each tile slot and marks it ready once loaded', async () => {
    const observed: Element[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(target: Element) {
          observed.push(target)
        }
        disconnect() {}
      },
    )
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { wrapper } = renderInventory()
    await waitFor(() => expect(scene.setSlots).toHaveBeenCalled())
    sceneOptions().onReady()

    await waitFor(() => expect(wrapper).toHaveAttribute('data-scene', 'ready'))
    expect(vi.mocked(scene.setSlots).mock.lastCall?.[0]).toHaveLength(2)
    expect(observed).toEqual([wrapper])
  })

  it('lifts the block under the pointer or focus', async () => {
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    renderInventory()
    await waitFor(() => expect(scene.setSlots).toHaveBeenCalled())
    const link = screen.getByRole('link', { name: /Erik Berg/ })

    fireEvent.pointerEnter(link)
    expect(scene.setHovered).toHaveBeenLastCalledWith(1)
    fireEvent.pointerLeave(link)
    expect(scene.setHovered).toHaveBeenLastCalledWith(null)
    fireEvent.focus(link)
    expect(scene.setHovered).toHaveBeenLastCalledWith(1)
    fireEvent.blur(link)
    expect(scene.setHovered).toHaveBeenLastCalledWith(null)
  })

  it('falls back to the initials when WebGL is unavailable', async () => {
    mockedCreateScene.mockReturnValue(null)

    const { wrapper } = renderInventory()

    await waitFor(() => expect(wrapper).toHaveAttribute('data-scene', 'fallback'))
  })

  it('falls back when the scene files fail to load', async () => {
    mockedCreateScene.mockReturnValue(fakeScene())

    const { wrapper } = renderInventory()
    await waitFor(() => expect(mockedCreateScene).toHaveBeenCalled())
    sceneOptions().onError(new Error('404'))

    await waitFor(() => expect(wrapper).toHaveAttribute('data-scene', 'fallback'))
  })

  it('falls back when the scene cannot be set up at all', async () => {
    mockedCreateScene.mockImplementation(() => {
      throw new Error('chunk failed')
    })

    const { wrapper } = renderInventory()

    await waitFor(() => expect(wrapper).toHaveAttribute('data-scene', 'fallback'))
    expect(console.error).toHaveBeenCalled()
  })

  it('releases the scene on unmount', async () => {
    const scene = fakeScene()
    mockedCreateScene.mockReturnValue(scene)

    const { unmount } = renderInventory()
    await waitFor(() => expect(scene.setSlots).toHaveBeenCalled())
    unmount()

    expect(scene.dispose).toHaveBeenCalledTimes(1)
  })

  it('never builds a scene when unmounted before it arrives', async () => {
    const { unmount } = renderInventory()
    unmount()
    await import('./createInventoryScene')
    await Promise.resolve()

    expect(mockedCreateScene).not.toHaveBeenCalled()
  })
})
