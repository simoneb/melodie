'use strict'

import faker from 'faker'
import { get } from 'svelte/store'
import {
  playlists,
  list,
  remove,
  appendTracks,
  removeTrack,
  moveTrack,
  isListing
} from './playlists'
import { clear, current } from './snackbars'
import { mockInvoke, sleep, translate } from '../tests'

describe('playlists store', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clear()
  })

  it('lists all playlists', async () => {
    const total = 13
    const data = Array.from({ length: total }, (v, i) => ({
      id: i,
      name: `${i}0`
    }))
    mockInvoke.mockImplementation(
      async (channel, service, method, type, { size, from }) => ({
        total,
        size,
        from: from || 0,
        results: data.slice(from || 0, from + size)
      })
    )
    expect(get(playlists)).toEqual([])
    expect(get(isListing)).toBe(false)
    await list()
    expect(get(isListing)).toBe(true)
    await sleep(100)
    expect(get(isListing)).toBe(false)
    expect(get(playlists)).toEqual(data)
    expect(mockInvoke).toHaveBeenCalledWith(
      'remote',
      'tracks',
      'list',
      'playlist',
      expect.any(Object)
    )
  })

  describe('appendTracks', () => {
    it('does not append empty track list', async () => {
      const id = faker.random.number()
      expect(await appendTracks({ id, tracks: [] })).toEqual(null)
      expect(mockInvoke).not.toHaveBeenCalled()
      expect(get(current)).toBeNil()
    })

    it('appends tracks to existing playlist', async () => {
      const tracks = [
        { id: 1, path: faker.system.fileName() },
        { id: 2, path: faker.system.fileName() }
      ]
      const trackIds = tracks.map(({ id }) => id)

      const id = faker.random.number()
      const playlist = { id, trackIds }
      mockInvoke.mockResolvedValueOnce(playlist)

      expect(await appendTracks({ id, tracks })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenCalledWith(
        'remote',
        'playlists',
        'append',
        id,
        trackIds
      )
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      await sleep()
      expect(get(current)).toEqual({
        message: translate('playlist _ updated', playlist),
        action: expect.any(Function),
        button: translate('open')
      })
    })

    it('creates new playlist with tracks', async () => {
      const tracks = [
        { id: 1, path: faker.system.fileName() },
        { id: 2, path: faker.system.fileName() }
      ]
      const trackIds = tracks.map(({ id }) => id)

      const name = faker.commerce.productName()
      const playlist = { id: faker.random.number(), name, trackIds }
      mockInvoke.mockResolvedValueOnce(playlist)

      expect(await appendTracks({ name, tracks })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenCalledWith('remote', 'playlists', 'save', {
        name,
        trackIds
      })
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      await sleep()
      expect(get(current)).toEqual({
        message: translate('playlist _ updated', playlist),
        action: expect.any(Function),
        button: translate('open')
      })
    })
  })

  describe('removeTrack', () => {
    it('removes track by index', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [
          faker.random.number(),
          faker.random.number(),
          faker.random.number(),
          faker.random.number()
        ]
      }
      mockInvoke.mockResolvedValueOnce(playlist)

      expect(await removeTrack(playlist, 2)).toEqual(playlist)
      expect(mockInvoke).toHaveBeenCalledWith('remote', 'playlists', 'save', {
        ...playlist,
        trackIds: [
          ...playlist.trackIds.slice(0, 2),
          ...playlist.trackIds.slice(2)
        ]
      })
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      expect(get(current)).toBeNil()
    })

    it('ignores invalid indices', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [
          faker.random.number(),
          faker.random.number(),
          faker.random.number(),
          faker.random.number()
        ]
      }
      mockInvoke.mockResolvedValue(playlist)

      expect(await removeTrack(playlist, -1)).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        1,
        'remote',
        'playlists',
        'save',
        playlist
      )

      expect(await removeTrack(playlist, 100)).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        2,
        'remote',
        'playlists',
        'save',
        playlist
      )
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })

  describe('moveTrack', () => {
    it('move tracks forward', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [1, 2, 3, 4]
      }
      mockInvoke.mockResolvedValueOnce(playlist)

      expect(await moveTrack(playlist, { from: 0, to: 2 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenCalledWith('remote', 'playlists', 'save', {
        ...playlist,
        trackIds: [2, 3, 1, 4]
      })
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      expect(get(current)).toBeNil()
    })

    it('move tracks backward', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [1, 2, 3, 4]
      }
      mockInvoke.mockResolvedValueOnce(playlist)

      expect(await moveTrack(playlist, { from: 3, to: 1 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenCalledWith(
        'remote',
        'playlists',
        'save',

        { ...playlist, trackIds: [1, 4, 2, 3] }
      )
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      expect(get(current)).toBeNil()
    })

    it('ignores invalid indices', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [1, 2, 3, 4]
      }
      mockInvoke.mockResolvedValue(playlist)

      expect(await moveTrack(playlist, { from: -1, to: 3 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        1,
        'remote',
        'playlists',
        'save',
        playlist
      )

      expect(await moveTrack(playlist, { from: 200, to: 1 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        2,
        'remote',
        'playlists',
        'save',
        playlist
      )

      expect(await moveTrack(playlist, { from: 1, to: -3 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        3,
        'remote',
        'playlists',
        'save',
        playlist
      )

      expect(await moveTrack(playlist, { from: 1, to: 100 })).toEqual(playlist)
      expect(mockInvoke).toHaveBeenNthCalledWith(
        4,
        'remote',
        'playlists',
        'save',
        playlist
      )
      expect(mockInvoke).toHaveBeenCalledTimes(4)
    })
  })

  describe('remove', () => {
    it('removes playlist', async () => {
      const playlist = {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [faker.random.number(), faker.random.number()]
      }
      mockInvoke.mockResolvedValueOnce(null)

      expect(await remove(playlist)).toBeNull()
      expect(mockInvoke).toHaveBeenCalledWith('remote', 'playlists', 'save', {
        id: playlist.id,
        trackIds: []
      })
      expect(mockInvoke).toHaveBeenCalledTimes(1)
      expect(get(current)).toBeNil()
    })
  })
})
