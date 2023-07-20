<script lang="ts">
  import type { Subscription } from '$lib/types.js';

  export let data;

  const { subscriptions }: { subscriptions: Subscription[] } = data;
</script>

<div class="flex max-h-screen min-h-screen bg-zinc-950">
  <div class="flex w-20 flex-col gap-3 overflow-scroll bg-zinc-800 px-3 py-3">
    {#each subscriptions as subscription}
      <div>
        <img
          src={subscription.snippet.thumbnails.default.url}
          alt="channel avatar"
          class="rounded-full" />
      </div>
    {/each}
  </div>
  <div class="w-3/12 bg-zinc-200">video feed</div>
  <div class="w-">video</div>
</div>
