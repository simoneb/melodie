<script>
  import { _ } from 'svelte-intl'
  import { add } from '../../stores/track-queue'
  import { load } from '../../stores/artists'
  import Image from '../Image/Image.svelte'
  import Button from '../Button/Button.svelte'

  export let src

  async function handlePlay(evt, immediate = true) {
    if (!src.tracks) {
      src = await load(src.id)
    }
    add(src.tracks, immediate)
  }

  async function handleEnqueue(evt) {
    return handlePlay(evt, false)
  }
</script>

<style type="postcss">
  a {
    @apply inline-block w-64;
  }

  header {
    @apply text-center;
  }

  h4 {
    @apply text-sm;
  }

  .content {
    @apply relative;
  }

  a:hover .controls {
    @apply opacity-100;
  }

  .controls {
    @apply absolute opacity-0 transition-opacity duration-500 ease-in-out inset-x-0 text-center;
    bottom: 5%;
  }
</style>

<a href={`#/artist/${src.id}`} class={$$restProps.class}>
  <div class="content">
    <Image class="w-64 h-64 text-3xl actionable" rounded src={src.media} />
    <p class="controls">
      <Button
        data-testid="play"
        primary
        icon="play_arrow"
        large
        on:click={handlePlay} />
      <Button
        data-testid="enqueue"
        primary
        icon="playlist_add"
        large
        on:click={handleEnqueue} />
    </p>
  </div>
  <header>
    <h3>{src.name || $_('unknown')}</h3>
    {#if src.refs.length}
      <h4>
        {$_(src.refs.length === 1 ? 'an album' : '_ albums', {
          total: src.refs.length
        })}
      </h4>
    {/if}
  </header>
</a>
