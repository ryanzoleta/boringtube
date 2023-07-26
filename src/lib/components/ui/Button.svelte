<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let variant: 'primary' | 'secondary' | 'danger';
  export let value = '';

  let colors: string;

  switch (variant) {
    case 'primary':
      colors = 'bg-zinc-800 text-zinc-400 hover:bg-zinc-900';
      break;
    case 'secondary':
      colors = 'bg-zinc-800 text-zinc-400 hover:bg-zinc-900';
      break;
    case 'danger':
      colors = 'bg-red-900 text-red-300 hover:bg-red-800';
      break;
  }

  const dispatch = createEventDispatcher();
</script>

<button
  class="h-fit rounded-lg px-4 py-2 font-bold transition duration-200 {colors}"
  formmethod="dialog"
  {value}
  on:click={() => {
    dispatch('click');
  }}><slot /></button>
