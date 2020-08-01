'use strict'

import { BehaviorSubject, ReplaySubject } from 'rxjs'
import { mergeMap, map, scan } from 'rxjs/operators'
import { fromServerChannel, invoke } from '../utils'

const collator = new Intl.Collator([], { numeric: true })

export const changes = fromServerChannel('album-change')

export const removals = fromServerChannel('album-removal')

changes.subscribe(changed => albums$.next({ changed }))

removals.subscribe(removedId => albums$.next({ removedId }))

const albums$ = new ReplaySubject().pipe(
  scan((list, { clear, added, changed, removedId }) => {
    if (clear) {
      list = []
    }
    if (added) {
      list.push(...added)
    }
    if (changed) {
      const idx = list.findIndex(({ id }) => id === changed.id)
      if (idx !== -1) {
        list[idx] = changed
      } else {
        list.push(changed)
      }
      list = list.sort((a, b) => collator.compare(a.name, b.name))
    }
    if (removedId) {
      const idx = list.findIndex(({ id }) => id === removedId)
      if (idx !== -1) {
        list.splice(idx, 1)
      }
    }
    return list
  }, [])
)

// first init
reset()

export const albums = {
  subscribe: albums$.subscribe.bind(albums$)
}

export function reset() {
  albums$.next({ clear: true })
}

export async function list() {
  albums$.next({ clear: true })

  const request$ = new BehaviorSubject({})

  request$
    .pipe(
      mergeMap(arg => invoke('listEngine.listAlbums', arg)),
      map(data => {
        const { size, from, total, results } = data
        albums$.next({ added: results })
        const nextFrom = from + results.length
        if (nextFrom < total) {
          request$.next({ from: nextFrom, size, total })
        } else {
          request$.complete()
        }
      })
    )
    .subscribe()
}

export async function load(id) {
  const album = await invoke('listEngine.fetchWithTracks', 'album', id)
  if (album) {
    albums$.next({ changed: album })
  }
  return album
}
