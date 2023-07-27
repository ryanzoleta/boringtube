<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let selected = false;
</script>

<button
  class="rounded-md px-4 py-1 transition duration-100 {selected
    ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
    : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
  on:click={() => {
    dispatch('click');
  }}>
  <slot />
</button>
