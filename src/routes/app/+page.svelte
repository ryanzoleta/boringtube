<script lang="ts">
  import type { Subscription, Video } from '$lib/types.js';
  import { createQuery } from '@tanstack/svelte-query';
  import axios from 'axios';
  import moment from 'moment';

  export let data;

  let currentVideo: Video | undefined;
  let archivedVideoIds: string[] = [];
  let playing = false;

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

          if (archivedVideoIds.includes(videoId)) {
            continue;
          }

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

  function archiveVideo(videoId: string) {
    currentVideo = undefined;
    archivedVideoIds.push(videoId);
    $videosQuery.refetch();
  }
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
          class="group relative flex flex-col rounded-lg bg-zinc-900 text-left text-white transition duration-200 hover:bg-zinc-800"
          on:click={() => {
            playing = false;
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
              <p class="my-auto text-xs text-zinc-500">
                {video.channel.snippet.title} • {moment(video.published).fromNow()}
              </p>
            </div>
          </div>
          <button
            class="absolute bottom-2 right-2 hidden w-8 rounded-md p-1 text-zinc-700 hover:bg-zinc-900 group-hover:block"
            on:click|stopPropagation={() => {
              archiveVideo(video.id);
            }}
            ><svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-full w-full">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </button>
      {/each}
    {/if}
  </div>
  <div class="relative flex-1 bg-zinc-950">
    {#if currentVideo}
      {#if playing}
        <iframe
          src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          class="h-4/5 w-full"
          allowFullScreen />
      {:else}
        <img src={currentVideo.thumbnail} alt="video thumbnail" class="h-4/5 w-full" />
        <button
          class="absolute top-0 h-4/5 w-full bg-black opacity-70"
          on:click={() => {
            playing = true;
          }}>
          <div class=" m-auto h-full w-2/12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-full w-full fill-zinc-700 text-zinc-700">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
        </button>
      {/if}

      <div class="mr-10 mt-3 flex place-content-between">
        <h2 class="flex-1 text-2xl font-bold text-white">{currentVideo.title}</h2>
        <button
          class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
          on:click={() => {
            if (currentVideo) archiveVideo(currentVideo.id);
          }}>Archive</button>
      </div>
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
