'use strict'

import { get, writable } from 'svelte/store'
import { screen, render, fireEvent } from '@testing-library/svelte'
import html from 'svelte-htm'
import faker from 'faker'
import Player from './Player.svelte'
import { trackListData } from './Player.stories'
import {
  add,
  clear,
  current,
  jumpTo,
  isShuffling,
  playNext
} from '../../stores/track-queue'
import * as playlistStore from '../../stores/playlists'
import { sleep, mockInvoke } from '../../tests'

const { play, pause } = HTMLMediaElement.prototype

describe('Player component', () => {
  let mediaElementSource
  let gainNode
  let observer

  function mockAutoPlay(audio) {
    observer = new MutationObserver(mutations => {
      for (const { attributeName } of mutations) {
        if (attributeName === 'src') {
          audio.play()
        }
      }
    })
    observer.observe(audio, { attributes: true })
  }

  beforeEach(() => {
    location.hash = '#/'
    jest.resetAllMocks()
    window.AudioContext = function () {
      return {
        createMediaElementSource: jest.fn().mockReturnValue(mediaElementSource),
        createGain: jest.fn().mockReturnValue(gainNode)
      }
    }
    mediaElementSource = { connect: jest.fn() }
    gainNode = { connect: jest.fn(), gain: { value: 1 } }

    play.mockImplementation(function () {
      this.dispatchEvent(new Event('play'))
    })
    pause.mockImplementation(function () {
      this.dispatchEvent(new Event('pause'))
    })
    clear()
    mockInvoke.mockResolvedValueOnce({ total: 0, results: [] })
  })

  afterEach(() => {
    if (observer) {
      observer.disconnect()
    }
  })

  it('plays and pause track', async () => {
    add(trackListData)
    expect(play).not.toHaveBeenCalled()

    render(html`<${Player} />`)

    const audio = screen.getByTestId('audio')
    expect(audio).toHaveAttribute('src', trackListData[0].path)

    await fireEvent.click(screen.getByText('play_arrow'))

    expect(get(current)).toEqual(trackListData[0])
    expect(play).toHaveBeenCalled()

    await fireEvent.click(screen.getByText('pause'))

    expect(get(current)).toEqual(trackListData[0])
    expect(pause).toHaveBeenCalled()
  })

  it('mutes and unmute volume', async () => {
    add(trackListData)

    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')

    expect(audio.muted).toEqual(false)
    await fireEvent.click(screen.getByText('volume_up'))
    expect(audio.muted).toEqual(true)

    await fireEvent.click(screen.getByText('volume_off'))
    expect(audio.muted).toEqual(false)
  })

  it('goes to next track', async () => {
    add(trackListData)

    render(html`<${Player} />`)

    await fireEvent.click(screen.getByText('skip_next'))

    expect(get(current)).toEqual(trackListData[1])
  })

  it('goes to previous track', async () => {
    add(trackListData)
    jumpTo(2)
    expect(get(current)).toEqual(trackListData[2])

    render(html`<${Player} />`)

    await fireEvent.click(screen.getByText('skip_previous'))

    expect(get(current)).toEqual(trackListData[1])
  })

  it('toggles playlist open state', async () => {
    const isPlaylistOpen = new writable(true)
    render(html`<${Player} bind:isPlaylistOpen=${isPlaylistOpen} />`)

    await fireEvent.click(screen.getByText('queue_music'))
    expect(get(isPlaylistOpen)).toBe(false)

    await fireEvent.click(screen.getByText('queue_music'))
    expect(get(isPlaylistOpen)).toBe(true)
  })

  it('can change volume', async () => {
    add(trackListData)

    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')

    const slider = screen.queryAllByRole('slider')[1]
    await fireEvent.input(slider, { target: { value: '50' } })

    expect(audio.volume).toEqual(0.5)

    await fireEvent.input(slider, { target: { value: '100' } })
    expect(audio.volume).toEqual(1)
  })

  it(`navigates to current track's album`, async () => {
    add(trackListData)

    render(html`<${Player} />`)
    await fireEvent.click(screen.getByRole('img'))
    await sleep()

    expect(location.hash).toEqual(`#/album/${trackListData[0].albumRef[0]}`)
  })

  it(`navigates to current track's artist`, async () => {
    add(trackListData)

    render(html`<${Player} />`)
    await fireEvent.click(screen.getByText(trackListData[0].artistRefs[0][1]))
    await sleep()

    expect(location.hash).toEqual(
      `#/artist/${trackListData[0].artistRefs[0][0]}`
    )
  })

  it('applies track and album ReplayGain when available', async () => {
    add(trackListData)

    render(html`<${Player} />`)

    expect(gainNode.gain.value).toEqual(1)

    jumpTo(1)
    expect(gainNode.gain.value).toEqual(
      trackListData[1].tags.replaygain_track_gain.ratio
    )

    jumpTo(2)
    expect(gainNode.gain.value).toEqual(
      trackListData[2].tags.replaygain_album_gain.ratio
    )

    jumpTo(3)
    expect(gainNode.gain.value).toEqual(
      trackListData[3].tags.replaygain_track_gain.ratio
    )

    jumpTo(0)
    expect(gainNode.gain.value).toEqual(1)
  })

  it('goes to next track on track end', async () => {
    add(trackListData)
    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')
    mockAutoPlay(audio)
    expect(get(current)).toEqual(trackListData[0])

    audio.dispatchEvent(new Event('ended'))
    expect(get(current)).toEqual(trackListData[1])
    await sleep()

    expect(screen.queryByText('pause')).toBeInTheDocument()
    expect(screen.queryByText('play_arrow')).toBeNull()
  })

  it('stops when last track has ended', async () => {
    add(trackListData)
    jumpTo(3)

    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')
    mockAutoPlay(audio)
    expect(get(current)).toEqual(trackListData[3])

    audio.dispatchEvent(new Event('ended'))
    expect(get(current)).toEqual(trackListData[3])
    await sleep()

    expect(screen.queryByText('pause')).toBeNull()
    expect(screen.queryByText('play_arrow')).toBeInTheDocument()
  })

  it('restarts to first track when repeat is on and last track has ended', async () => {
    add(trackListData)
    jumpTo(3)

    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')
    mockAutoPlay(audio)

    await fireEvent.click(screen.getByText('repeat'))
    expect(get(current)).toEqual(trackListData[3])

    audio.dispatchEvent(new Event('ended'))
    expect(get(current)).toEqual(trackListData[0])
    await sleep()

    expect(screen.queryByText('pause')).toBeInTheDocument()
    expect(screen.queryByText('play_arrow')).toBeNull()
  })

  it('repeat current track when repeat one is on', async () => {
    add(trackListData)
    jumpTo(3)

    render(html`<${Player} />`)
    const audio = screen.getByTestId('audio')
    mockAutoPlay(audio)

    await fireEvent.click(screen.getByText('repeat'))
    await fireEvent.click(screen.getByText('repeat'))

    expect(get(current)).toEqual(trackListData[3])
    await sleep()

    audio.dispatchEvent(new Event('ended'))
    expect(get(current)).toEqual(trackListData[3])
    await sleep()

    audio.dispatchEvent(new Event('ended'))
    expect(get(current)).toEqual(trackListData[3])
    await sleep()

    expect(screen.queryByText('pause')).toBeInTheDocument()
    expect(screen.queryByText('play_arrow')).toBeNull()
  })

  it('shuffles and unshuffles current track when repeat one is on', async () => {
    render(html`<${Player} />`)

    await fireEvent.click(screen.getByText('shuffle'))
    expect(get(isShuffling)).toEqual(true)

    await fireEvent.click(screen.getByText('shuffle'))
    expect(get(isShuffling)).toEqual(false)
  })

  describe('given some playlist', () => {
    const playlists = [
      {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [faker.random.number(), faker.random.number()]
      },
      {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [faker.random.number(), faker.random.number()]
      },
      {
        id: faker.random.number(),
        name: faker.commerce.productName(),
        trackIds: [faker.random.number(), faker.random.number()]
      }
    ]

    beforeEach(async () => {
      jest.resetAllMocks()
      playlistStore.reset()
      mockInvoke.mockResolvedValue({
        total: playlists.length,
        size: playlists.length,
        from: 0,
        results: playlists
      })
    })

    it('adds current track to existing playlist', async () => {
      add(trackListData)
      jumpTo(3)

      render(html`<${Player} />`)
      await sleep()
      jest.resetAllMocks()

      const playlist = faker.random.arrayElement(playlists)

      await fireEvent.click(screen.queryByText('library_add'))
      await fireEvent.click(screen.queryByText(playlist.name))

      playNext()

      await fireEvent.click(screen.queryByText('library_add'))
      await fireEvent.click(screen.queryByText(playlist.name))

      expect(mockInvoke).toHaveBeenNthCalledWith(
        1,
        'remote',
        'playlists',
        'append',
        playlist.id,
        [trackListData[3].id]
      )
      expect(mockInvoke).toHaveBeenNthCalledWith(
        2,
        'remote',
        'playlists',
        'append',
        playlist.id,
        [trackListData[0].id]
      )
      expect(mockInvoke).toHaveBeenCalledTimes(2)
    })
  })
})
