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
  let playing = false;

  let viewingVideoList: Video[] = [];
  let view: 'NEW' | 'ARCHIVED' | 'WATCH_LATER' = 'NEW';
  let currentChannel: Subscription | undefined;

  let theaterMode = false;

  let localAllVideos: Video[];

  $: {
    if (browser && localAllVideos) {
      localStorage.setItem('all_videos', JSON.stringify(localAllVideos));
      $videosQuery.refetch();
    }
  }

  const { subscriptions }: { subscriptions: Subscription[] } = data;

  const allVideosQuery = createQuery({
    queryKey: ['all_videos'],
    queryFn: async () => {
      const localAllVideoIds = localAllVideos.map((v) => {
        return v.id;
      });

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
      let newAllVideos = [...data, ...localAllVideos];
      newAllVideos = newAllVideos.sort((a, b) => {
        return a.published.localeCompare(b.published) * -1;
      });
      localAllVideos = newAllVideos;
      console.log('Successfully saved', data.length, 'videos');
    }
  });

  $allVideosQuery;

  const videosQuery = createInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const start = (pageParam - 1) * 20;
      const end = pageParam * 20;

      if (currentChannel) {
        return localAllVideos
          .filter((v) => {
            return v.status === view && v.channel.id === currentChannel?.id;
          })
          .slice(start, end);
      } else {
        return localAllVideos
          .filter((v) => {
            return v.status === view;
          })
          .slice(start, end);
      }
    },
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length + 1;
    }
  });

  $: if (view) $videosQuery.refetch();

  function archiveVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'ARCHIVED';
      }
      return v;
    });
  }

  function unarchiveVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'NEW';
      }
      return v;
    });
  }

  function archiveAll() {
    localAllVideos = localAllVideos.map((v) => {
      if (v.status === 'NEW') {
        v.status = 'ARCHIVED';
      }
      return v;
    });

    const dialog = document.getElementById('archiveAllConfirmation');
    if (dialog) {
      //@ts-ignore
      dialog.close();
    }
  }

  function watchLaterVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'WATCH_LATER';
      }
      return v;
    });
  }

  $: {
    if ($videosQuery.data) {
      viewingVideoList = $videosQuery.data.pages.flatMap((page) => {
        return page;
      });
    }
  }

  let observer: IntersectionObserver;

  onMount(() => {
    const localAllVideosString = localStorage.getItem('all_videos');
    localAllVideos = localAllVideosString ? JSON.parse(localAllVideosString) : [];
    console.log('Found', localAllVideos.length, 'videos on local storage');

    let options = {
      root: null,
      rootMargin: '0px',
      threshold: 1.0
    };

    observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          $videosQuery.fetchNextPage();
        }
      });
    }, options);
  });

  let lastItem: Element;

  $: if (observer && lastItem) observer.observe(lastItem);

  $: {
    currentChannel;
    $videosQuery.refetch();
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
            <button
              on:click={() => {
                currentChannel = currentChannel?.id === subscription.id ? undefined : subscription;
              }}>
              <img
                src={subscription.snippet.thumbnails.default.url}
                alt="channel avatar"
                class={currentChannel?.id === subscription.id
                  ? 'rounded-full border-2 border-green-500'
                  : 'rounded-full'} />
            </button>
          {/each}
        </div>

        <div class="relative flex flex-1 flex-col overflow-scroll bg-zinc-950 px-3 pb-3">
          <div class="sticky top-0 z-50 flex flex-col gap-2 bg-zinc-950 py-3">
            <div class="flex gap-2">
              <button
                class="rounded-md px-4 py-1 transition duration-100 {view === 'NEW'
                  ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
                on:click={() => {
                  view = 'NEW';
                }}>New</button>
              <button
                class="rounded-md px-4 py-1 transition duration-100 {view === 'WATCH_LATER'
                  ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
                on:click={() => {
                  view = 'WATCH_LATER';
                }}>Watch Later</button>
              <button
                class="rounded-md px-4 py-1 transition duration-100 {view === 'ARCHIVED'
                  ? 'bg-zinc-50 text-zinc-900 hover:bg-zinc-200'
                  : 'bg-zinc-700 text-white hover:bg-zinc-600'}"
                on:click={() => {
                  view = 'ARCHIVED';
                }}>Archived</button>

              {#if view === 'NEW'}
                <button
                  class="group absolute right-0 block w-10 rounded-md bg-zinc-800 px-2 py-1 text-zinc-500 transition duration-200 hover:bg-zinc-700"
                  on:click={() => {
                    const dialog = document.getElementById('archiveAllConfirmation');
                    if (dialog) {
                      //@ts-ignore
                      dialog.showModal();
                    }
                  }}>
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
                  <div
                    class="absolute right-0 top-full mt-2 hidden w-24 rounded-md bg-red-900 px-2 py-2 text-red-300 shadow-md group-hover:block">
                    Archive all
                  </div>
                </button>
              {/if}
            </div>

            {#if currentChannel}
              <div class="flex gap-1">
                <div class="flex place-items-center">
                  <button
                    class=" w-7 rounded-full p-1 text-zinc-700 hover:bg-zinc-400"
                    on:click={() => {
                      currentChannel = undefined;
                    }}>
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
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <h1 class="text-zinc-600">
                  Viewing <span class="text-lg font-bold text-zinc-500"
                    >{currentChannel.snippet.title}</span>
                </h1>
              </div>
            {/if}
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
                  <div class="absolute bottom-1 right-2 flex">
                    {#if view === 'NEW' || view === 'ARCHIVED'}
                      <button
                        class=" hidden w-8 rounded-md p-1 text-zinc-700 hover:bg-zinc-900 group-hover:block"
                        on:click|stopPropagation={() => {
                          watchLaterVideo(video);
                        }}>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          class="h-6 w-6">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    {/if}

                    <button
                      class=" hidden w-8 rounded-md p-1 text-zinc-700 hover:bg-zinc-900 group-hover:block"
                      on:click|stopPropagation={() => {
                        if (view === 'NEW' || view === 'WATCH_LATER') archiveVideo(video);
                        else unarchiveVideo(video);
                      }}>
                      {#if view === 'NEW' || view === 'WATCH_LATER'}
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
                  </div>
                </button>
              {/each}

              {#if view === 'NEW'}
                <div bind:this={lastItem}>
                  <button class="rounded-full bg-zinc-800 px-4 py-2 text-white">More...</button>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <div class="relative z-10 flex-1 overflow-scroll bg-zinc-950">
    {#if currentVideo}
      {#if playing}
        <iframe
          src={`https://www.youtube.com/embed/${currentVideo.id}?autoplay=1`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          class={theaterMode ? 'z-0 h-full w-full' : 'z-0 h-4/5 w-full'}
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
        {#if view === 'NEW'}
          <button
            class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
            on:click={() => {
              if (currentVideo) {
                watchLaterVideo(currentVideo);
              }
            }}>
            {#if view === 'NEW'}
              Watch Later
            {/if}
          </button>
        {/if}
        <button
          class="rounded-md bg-zinc-800 px-4 py-2 font-bold text-zinc-400 transition duration-200 hover:bg-zinc-900"
          on:click={() => {
            if (currentVideo) {
              if (view === 'NEW') archiveVideo(currentVideo);
              else unarchiveVideo(currentVideo);
            }
          }}>
          {#if view === 'NEW'}
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

<dialog id="archiveAllConfirmation" class="rounded-lg bg-zinc-800 p-5 text-white">
  <form>
    <h1 class="text-2xl font-bold">Archive All</h1>
    <p class="text-zinc-300">Are you sure you want to archive all new videos in your feed?</p>
    <div class="mt-5 flex place-content-end gap-3">
      <button
        class="rounded-lg bg-red-900 px-4 py-2 font-bold text-red-300 transition duration-200 hover:bg-red-800"
        on:click={archiveAll}>Yes, archive all</button>
      <button
        class="rounded-lg bg-zinc-700 px-4 py-2 font-bold text-zinc-300 transition duration-200 hover:bg-zinc-600"
        formmethod="dialog"
        value="cancel">Cancel</button>
    </div>
  </form>
</dialog>
