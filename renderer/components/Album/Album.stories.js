'use strict'

import { action } from '@storybook/addon-actions'
import Album from './Album.svelte'

export default {
  title: 'Components/Album',
  excludeStories: /.*Data$/
}

export const albumData = {
  name: 'Diamonds on the inside',
  artists: ['Ben Harper'],
  media: './cover.jpg'
}

export const actionsData = {
  click: action('on album click'),
  play: action('on album play')
}

export const Default = () => ({
  Component: Album,
  props: {
    src: albumData
  },
  on: actionsData
})

export const NoArtist = () => ({
  Component: Album,
  props: {
    src: {
      ...albumData,
      artists: []
    }
  },
  on: actionsData
})
