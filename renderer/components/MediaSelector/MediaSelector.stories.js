'use strict'

import MediaSelector from './MediaSelector.stories.svelte'
import { actionsData } from '../Dialogue/Dialogue.stories'
import { artistData } from '../Artist/Artist.stories'
import { ipcRendererMock } from '../../../.storybook/decorators'

export default {
  title: 'Components/Media Selector',
  excludeStories: /.*Data$/,
  decorators: [
    ipcRendererMock(method => {
      if (method === 'findForArtist') {
        return artistSuggestionsData
      } else if (method === 'findForAlbum') {
        return albumSuggestionsData
      }
    })
  ]
}

export const artistSuggestionsData = [
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/thumb/vuvqxr1352453964.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/tvpvrv1340621795.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/vtvsww1340621807.jpg',
    provider: 'Discogs'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/thumb/vuvqxr1352453964.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/tvpvrv1340621795.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/vtvsww1340621807.jpg',
    provider: 'Discogs'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/thumb/vuvqxr1352453964.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/tvpvrv1340621795.jpg',
    provider: 'AudioDB'
  },
  {
    artwork:
      'https://www.theaudiodb.com/images/media/artist/fanart/vtvsww1340621807.jpg',
    provider: 'Discogs'
  }
]

export const albumSuggestionsData = artistSuggestionsData.map(
  ({ artwork, provider }) => ({ cover: artwork, provider })
)

export const Default = () => ({
  Component: MediaSelector,
  props: {
    src: artistData
  },
  on: actionsData
})

export const ForAlbum = () => ({
  Component: MediaSelector,
  props: {
    forArtist: false,
    src: artistData
  },
  on: actionsData
})
