<script lang="ts">
  import type { Subscription, Video } from '$lib/types.js';
  import { createQuery } from '@tanstack/svelte-query';
  import axios from 'axios';
  import moment from 'moment';

  export let data;

  let currentVideo: Video;

  const { subscriptions }: { subscriptions: Subscription[] } = data;

  const videosQuery = createQuery({
    queryKey: ['feed'],
    queryFn: async () => {
      let videos = [];

      for (const channel of subscriptions) {
        const rssResponse = await axios.get(
          `https://zoletacors.up.railway.app/https://www.youtube.com/feeds/videos.xml?channel_id=${channel.snippet.resourceId.channelId}`
        );

        const xmlStr = rssResponse.data;
        const xml = new window.DOMParser().parseFromString(xmlStr, 'text/xml');
        const entries = xml.querySelectorAll('entry');

        for (const entry of entries) {
          const videoId = entry.getElementsByTagName('yt:videoId')[0].innerHTML;
          const published = moment(entry.getElementsByTagName('published')[0].innerHTML);

          const daysOld = moment().diff(published, 'days');

          if (daysOld < 3) {
            videos.push({
              id: videoId,
              title: entry.getElementsByTagName('title')[0].innerHTML,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
              channel: channel,
              published: entry.getElementsByTagName('published')[0].innerHTML
            });
          } else {
            break;
          }
        }
      }

      videos = videos.sort((a, b) => {
        return a.published.localeCompare(b.published) * -1;
      });

      if (!currentVideo) currentVideo = videos[0];

      return videos;
    }
  });
</script>

<div class="flex max-h-screen min-h-screen bg-zinc-950">
  <div class="flex w-20 flex-col gap-3 overflow-scroll bg-zinc-950 px-3 py-3">
    {#each subscriptions as subscription}
      <div>
        <img
          src={subscription.snippet.thumbnails.default.url}
          alt="channel avatar"
          class="rounded-full" />
      </div>
    {/each}
  </div>
  <div class="flex w-1/5 flex-col gap-3 overflow-scroll bg-zinc-950 px-3 py-3">
    {#if $videosQuery.isLoading}
      <p>Loading...</p>
    {:else if $videosQuery.data}
      {#each $videosQuery.data as video}
        <button
          class="flex flex-col rounded-lg bg-zinc-900 text-left text-white transition duration-200 hover:bg-zinc-800"
          on:click={() => {
            currentVideo = video;
          }}>
          <img src={video.thumbnail} alt="video thumbnail" class="w-full rounded-t-md" />
          <div class="flex flex-col gap-1 p-3">
            <h3 class="line-clamp-2 font-bold leading-tight">{video.title}</h3>
            <div class="flex gap-1">
              <div class="w-5">
                <img
                  src={video.channel.snippet.thumbnails.default.url}
                  alt="channel avatar"
                  class="rounded-full" />
              </div>
              <p class="text-xs text-zinc-500">{video.channel.snippet.title}</p>
            </div>
            <p class="text-xs text-zinc-500">{moment(video.published).fromNow()}</p>
          </div>
        </button>
      {/each}
    {/if}
  </div>
  <div class="flex-1 bg-zinc-950">
    {#if currentVideo}
      <iframe
        src={`https://www.youtube.com/embed/${currentVideo.id}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        class="h-4/5 w-full"
        allowFullScreen />
      <!-- <img src={currentVideo.thumbnail} alt="video thumbnail" class="h-4/5 w-full" /> -->
      <h2 class="mt-3 text-2xl font-bold text-white">{currentVideo.title}</h2>
      <div class="mt-2 flex gap-2">
        <div class="w-14">
          <img
            src={currentVideo.channel.snippet.thumbnails.default.url}
            alt="channel avatar"
            class="rounded-full" />
        </div>
        <div>
          <p class="text-lg font-bold text-zinc-400">{currentVideo.channel.snippet.title}</p>
          <p class="text-zinc-500">{moment(currentVideo.published).fromNow()}</p>
        </div>
      </div>
    {/if}
  </div>
</div>
