import { Vec } from '@tldraw/vec'
import { TLDrawSnapshot, TLDrawCommand, PagePartial, Session } from '~types'
import { TLDR } from '~state/TLDR'

export function translateShapes(
  data: TLDrawSnapshot,
  ids: string[],
  delta: number[]
): TLDrawCommand {
  const { currentPageId } = data.appState

  // Clear session cache
  Session.cache.selectedIds = TLDR.getSelectedIds(data, data.appState.currentPageId)

  const before: PagePartial = {
    shapes: {},
    bindings: {},
  }

  const after: PagePartial = {
    shapes: {},
    bindings: {},
  }

  const idsToMutate = ids.flatMap((id) => {
    const shape = TLDR.getShape(data, id, currentPageId)
    return shape.children ? shape.children : shape.id
  })

  const change = TLDR.mutateShapes(
    data,
    idsToMutate,
    (shape) => ({
      point: Vec.round(Vec.add(shape.point, delta)),
    }),
    currentPageId
  )

  before.shapes = change.before
  after.shapes = change.after

  // Delete bindings from nudged shapes, unless both bound and bound-to shapes are selected
  const bindingsToDelete = TLDR.getBindings(data, currentPageId).filter(
    (binding) => ids.includes(binding.fromId) && !ids.includes(binding.toId)
  )

  bindingsToDelete.forEach((binding) => {
    before.bindings[binding.id] = binding
    after.bindings[binding.id] = undefined

    for (const id of [binding.toId, binding.fromId]) {
      // Let's also look at the bound shape...
      const shape = TLDR.getShape(data, id, data.appState.currentPageId)

      if (!shape.handles) continue

      // If the bound shape has a handle that references the deleted binding, delete that reference

      Object.values(shape.handles)
        .filter((handle) => handle.bindingId === binding.id)
        .forEach((handle) => {
          before.shapes[id] = {
            ...before.shapes[id],
            handles: {
              ...before.shapes[id]?.handles,
              [handle.id]: { bindingId: binding.id },
            },
          }
          after.shapes[id] = {
            ...after.shapes[id],
            handles: { ...after.shapes[id]?.handles, [handle.id]: { bindingId: undefined } },
          }
        })
    }
  })

  return {
    id: 'translate',
    before: {
      document: {
        pages: {
          [currentPageId]: before,
        },
        pageStates: {
          [currentPageId]: {
            selectedIds: ids,
          },
        },
      },
    },
    after: {
      document: {
        pages: {
          [currentPageId]: after,
        },
        pageStates: {
          [currentPageId]: {
            selectedIds: ids,
          },
        },
      },
    },
  }
}
