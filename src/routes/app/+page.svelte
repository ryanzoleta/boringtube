<script lang="ts">
  import type { Subscription } from '$lib/types.js';
  import { createQuery } from '@tanstack/svelte-query';
  import axios from 'axios';

  export let data;

  const { subscriptions }: { subscriptions: Subscription[] } = data;

  const videosQuery = createQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      const videos = [];

      for (const channel of subscriptions) {
        const rssResponse = await axios.get(
          `https://zoletacors.up.railway.app/https://www.youtube.com/feeds/videos.xml?channel_id=${channel.snippet.resourceId.channelId}`
        );

        const xmlStr = rssResponse.data;
        const xml = new window.DOMParser().parseFromString(xmlStr, 'text/xml');
        const entries = xml.querySelectorAll('entry');

        for (const entry of entries) {
          videos.push({
            id: entry.getElementsByTagName('yt:videoId')[0].innerHTML,
            title: entry.getElementsByTagName('title')[0].innerHTML,
            url: `https://www.youtube.com/watch?v=${
              entry.getElementsByTagName('yt:videoId')[0].innerHTML
            }`,
            thumbnail: entry.getElementsByTagName('media:thumbnail')[0].getAttribute('url')
          });
        }

        break;
      }

      return videos;
    }
  });
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
  <div class="w-3/12 overflow-scroll bg-zinc-900">
    {#if $videosQuery.isLoading}
      <p>Loading...</p>
    {:else if $videosQuery.data}
      {#each $videosQuery.data as video}
        <div>
          <img src={video.thumbnail} alt="video thumbnail" />
        </div>
      {/each}
    {/if}
  </div>
  <div class="w-">video</div>
</div>
