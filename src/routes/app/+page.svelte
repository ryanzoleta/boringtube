<script lang="ts">
  import { browser } from '$app/environment';
  import type { Subscription, Video } from '$lib/types.js';
  import { signOut } from '@auth/sveltekit/client';
  import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
  import axios from 'axios';
  import moment from 'moment';
  import { onMount } from 'svelte';

  export let data;

  let currentVideo: Video | undefined;
  let archivedVideos: Video[] = [];
  let archivedVideoIds: string[] = [];
  let playing = false;

  let viewingVideoList: Video[] = [];
  let view: 'new' | 'archived' = 'new';

  let theaterMode = false;

  const { subscriptions }: { subscriptions: Subscription[] } = data;

  const allVideosQuery = createQuery({
    queryKey: ['all_videos'],
    queryFn: async () => {
      const localAllVideosString = localStorage.getItem('all_videos');

      const localAllVideos: Video[] = localAllVideosString ? JSON.parse(localAllVideosString) : [];
      const localAllVideoIds = localAllVideos.map((v) => {
        return v.id;
      });

      console.log('Found', localAllVideoIds.length, 'videos on local storage');

      let videos: Video[] = [];

      for (const channel of subscriptions) {
        const rssResponse = await axios.get(
          `https://zoletacors.up.railway.app/https://www.youtube.com/feeds/videos.xml?channel_id=${channel.snippet.resourceId.channelId}`
        );

        const xmlStr = rssResponse.data;
        const xml = new window.DOMParser().parseFromString(xmlStr, 'text/xml');
        const entries = xml.querySelectorAll('entry');

        for (const entry of entries) {
          const videoId = entry.getElementsByTagName('yt:videoId')[0].innerHTML;
          const published = entry.getElementsByTagName('published')[0].innerHTML;

          if (localAllVideoIds.includes(videoId)) {
            continue;
          }

          videos.push({
            id: videoId,
            title: entry.getElementsByTagName('title')[0].innerHTML,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
            channel: channel,
            published: published,
            status: 'NEW'
          });
        }
      }

      if (!currentVideo) currentVideo = videos[0];

      return videos;
    },
    onSuccess: (data) => {
      const localAllVideosString = localStorage.getItem('all_videos');
      const localAllVideos: Video[] = localAllVideosString ? JSON.parse(localAllVideosString) : [];
      let newAllVideos = [...data, ...localAllVideos];
      newAllVideos = newAllVideos.sort((a, b) => {
        return a.published.localeCompare(b.published) * -1;
      });
      localStorage.setItem('all_videos', JSON.stringify(newAllVideos));
      console.log('Successfully saved', data.length, 'videos');
    }
  });

  $allVideosQuery;

  const videosQuery = createInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const localAllVideosString = localStorage.getItem('all_videos');
      const localAllVideos: Video[] = localAllVideosString ? JSON.parse(localAllVideosString) : [];

      const start = (pageParam - 1) * 20;
      const end = pageParam * 20;

      return localAllVideos.slice(start, end).filter((v) => {
        return v.status === (view === 'new' ? 'NEW' : 'ARCHIVED');
      });
    },
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length + 1;
    }
  });

  function archiveVideo(video: Video) {
    const localAllVideosString = localStorage.getItem('all_videos');
    const localAllVideos: Video[] = localAllVideosString ? JSON.parse(localAllVideosString) : [];
    const updatedAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'ARCHIVED';
      }
      return v;
    });
    localStorage.setItem('all_videos', JSON.stringify(updatedAllVideos));
    $videosQuery.refetch();
  }

  function unarchiveVideo(video: Video) {
    const localAllVideosString = localStorage.getItem('all_videos');
    const localAllVideos: Video[] = localAllVideosString ? JSON.parse(localAllVideosString) : [];
    const updatedAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'NEW';
      }
      return v;
    });
    localStorage.setItem('all_videos', JSON.stringify(updatedAllVideos));
    $videosQuery.refetch();
  }

  $: {
    if ($videosQuery.data) {
      viewingVideoList = $videosQuery.data.pages.flatMap((page) => {
        return page;
      });
      currentVideo = viewingVideoList[0];
    }
  }

  onMount(() => {
    const localArhivedVideos = localStorage.getItem('archivedVideos');
    const localArhivedVideoIds = localStorage.getItem('archivedVideoIds');

    if (localArhivedVideos && localArhivedVideoIds) {
      archivedVideos = JSON.parse(localArhivedVideos) as Video[];
      archivedVideoIds = JSON.parse(localArhivedVideoIds) as string[];
    }
  });

  $: {
    if (archivedVideos.length > 0 && archivedVideoIds.length > 0 && browser) {
      localStorage.setItem('archivedVideos', JSON.stringify(archivedVideos));
      localStorage.setItem('archivedVideoIds', JSON.stringify(archivedVideoIds));
    }
  }
</script>

<div class="flex h-screen max-h-screen min-h-screen bg-zinc-950">
  <div class="max-h-screen w-3/12 flex-col">
    <div class="flex h-[6%] place-content-between bg-zinc-900 p-3">
      <h1 class="my-auto text-3xl font-bold tracking-tight text-white">boringtube</h1>
      <button class="text-zinc-500 hover:underline" on:click={signOut}>Logout</button>
    </div>
    <div class="flex h-[94%]">
      {#if !theaterMode}
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

        <div class="relative flex flex-1 flex-col overflow-scroll bg-zinc-950 px-3 pb-3">
          <div class="sticky top-0 z-50 flex gap-2 bg-zinc-950 p-3">
            <button
              class="rounded-md px-4 py-1 transition duration-100 {view === 'new'
                ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
                : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
              on:click={() => {
                view = 'new';
                $videosQuery.refetch();
              }}>New</button>
            <button
              class="rounded-md px-4 py-1 transition duration-100 {view === 'archived'
                ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
                : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
              on:click={() => {
                view = 'archived';
                $videosQuery.refetch();
              }}>Archived</button>
          </div>
          {#if $videosQuery.isLoading}
            <div class="m-auto w-10 fill-zinc-500">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" class="animate-spin"
                ><path
                  d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z"
                  class="spinner_P7sC" /></svg>
            </div>
          {:else if viewingVideoList}
            <div class="flex flex-col gap-3">
              {#each viewingVideoList as video}
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
                      if (view === 'new') archiveVideo(video);
                      else unarchiveVideo(video);
                    }}>
                    {#if view === 'new'}
                      <svg
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
                    {:else}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        class="h-full w-full">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                      </svg>
                    {/if}
                  </button>
                </button>
              {/each}

              {#if view === 'new'}
                <div>
                  <button
                    class="rounded-full bg-zinc-800 px-4 py-2 text-white"
                    on:click={() => {
                      $videosQuery.fetchNextPage();
                    }}>More...</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="relative flex-1 overflow-scroll bg-zinc-950">
    {#if currentVideo}
      {#if playing}
        <iframe
          src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          class={theaterMode ? 'h-full w-full' : 'h-4/5 w-full'}
          allowFullScreen />
      {:else}
        <img
          src={currentVideo.thumbnail}
          alt="video thumbnail"
          class={theaterMode ? 'h-full w-full' : 'h-4/5 w-full'} />
        <button
          class="absolute top-0 bg-black opacity-70 {theaterMode
            ? 'h-full w-full'
            : 'h-4/5 w-full'}"
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
              class="h-full w-full fill-red-900 text-red-900">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
        </button>
      {/if}

      <div class="mr-10 mt-3 flex place-content-between gap-2 {theaterMode ? 'ml-7' : ''}">
        <h2 class="flex-1 text-2xl font-bold text-white">{currentVideo.title}</h2>
        <button
          class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
          on:click={() => {
            if (currentVideo) {
              if (view === 'new') archiveVideo(currentVideo);
              else unarchiveVideo(currentVideo);
            }
          }}>
          {#if view === 'new'}
            Archive
          {:else}
            Unarchive
          {/if}
        </button>
        {#if theaterMode}
          <button
            class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
            on:click={() => {
              theaterMode = false;
            }}>Exit Theather Mode</button>
        {:else}
          <button
            class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
            on:click={() => {
              theaterMode = true;
            }}>Enable Theather Mode</button>
        {/if}
      </div>
      <div class="mt-2 flex gap-2 {theaterMode ? 'ml-7' : ''}">
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
