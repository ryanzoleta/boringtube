<script lang="ts">
  import { browser } from '$app/environment';
  import IconClock from '$lib/components/icons/IconClock.svelte';
  import IconLoading from '$lib/components/icons/IconLoading.svelte';
  import IconPlay from '$lib/components/icons/IconPlay.svelte';
  import IconRestore from '$lib/components/icons/IconRestore.svelte';
  import IconTrash from '$lib/components/icons/IconTrash.svelte';
  import IconX from '$lib/components/icons/IconX.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import FilterButton from '$lib/components/ui/FilterButton.svelte';
  import type { Subscription, Video } from '$lib/types.js';
  import { signOut } from '@auth/sveltekit/client';
  import { createInfiniteQuery, createQuery } from '@tanstack/svelte-query';
  import axios from 'axios';
  import moment from 'moment';
  import { onMount } from 'svelte';

  let currentVideo: Video | undefined;
  let playing = false;

  let viewingVideoList: Video[] = [];
  let view: 'NEW' | 'ARCHIVED' | 'WATCH_LATER' = 'NEW';
  let currentChannel: Subscription | undefined;

  let theaterMode = false;

  let localAllVideos: Video[];

  const channelsQuery = createQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const response = await axios.get('/api/subscriptions');
      return response.data.subscriptions as Subscription[];
    }
  });

  const allVideosQuery = createQuery({
    queryKey: ['all_videos'],
    queryFn: async () => {
      const localAllVideoIds = localAllVideos.map((v) => v.id);

      let videos: Video[] = [];

      if (!$channelsQuery.data) {
        return [];
      }

      for (const channel of $channelsQuery.data) {
        const rssResponse = await axios.get(
          `https://zoletacors.up.railway.app/https://www.youtube.com/feeds/videos.xml?channel_id=${channel.snippet.resourceId.channelId}`
        );

        const xmlStr = rssResponse.data;
        const xml = new window.DOMParser().parseFromString(xmlStr, 'text/xml');
        const entries = xml.querySelectorAll('entry');

        for (const entry of entries) {
          const videoId = entry.getElementsByTagName('yt:videoId')[0].innerHTML;

          if (!localAllVideoIds.includes(videoId)) {
            videos.push({
              id: videoId,
              title: entry.getElementsByTagName('title')[0].innerHTML,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              thumbnail: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
              channel: channel,
              published: entry.getElementsByTagName('published')[0].innerHTML,
              status: 'NEW'
            });
          }
        }
      }

      if (!currentVideo) currentVideo = videos[0];

      return videos;
    },
    onSuccess: (data) => {
      localAllVideos = [...data, ...localAllVideos].sort(
        (a, b) => a.published.localeCompare(b.published) * -1
      );
      console.log('Successfully saved', data.length, 'new videos');
    }
  });

  $allVideosQuery;

  const videosQuery = createInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = 1 }) => {
      const start = (pageParam - 1) * 20;
      const end = pageParam * 20;

      if (!$channelsQuery.data) {
        return [];
      }

      return localAllVideos
        .filter((v) => {
          if (currentChannel) {
            return v.status === view && v.channel.id === currentChannel?.id;
          }

          return v.status === view;
        })
        .slice(start, end);
    },
    getNextPageParam: (lastPage, allPages) => {
      return allPages.length + 1;
    }
  });

  $: {
    if ($videosQuery.data) {
      viewingVideoList = $videosQuery.data.pages.flatMap((page) => {
        return page;
      });
    }
  }

  $: if (view) $videosQuery.refetch();

  $: {
    currentChannel;
    $videosQuery.refetch();
  }

  $: {
    if ($channelsQuery.data?.length && $channelsQuery.data?.length > 0) {
      $videosQuery.refetch();
    }
  }

  $: {
    if (browser && localAllVideos) {
      localStorage.setItem('all_videos', JSON.stringify(localAllVideos));
      $videosQuery.refetch();
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

    document.addEventListener('keyup', (event) => {
      if (event.key === 'Escape' && theaterMode) {
        theaterMode = false;
      }
    });
  });

  let lastItem: Element;

  $: if (observer && lastItem) observer.observe(lastItem);

  function archiveVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'ARCHIVED';
      }
      return v;
    });
    refreshCurrentVideo();
  }

  function unarchiveVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'NEW';
      }
      return v;
    });
    refreshCurrentVideo();
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
    refreshCurrentVideo();
  }

  function watchLaterVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'WATCH_LATER';
      }
      return v;
    });
    refreshCurrentVideo();
  }

  function unwatchLaterVideo(video: Video) {
    localAllVideos = localAllVideos.map((v) => {
      if (v.id === video.id) {
        v.status = 'NEW';
      }
      return v;
    });
    refreshCurrentVideo();
  }

  function refreshCurrentVideo() {
    currentVideo = localAllVideos.find((v) => {
      return v.id === currentVideo?.id;
    });
  }

  function getNextVideoInList(id: string, list: Video[]) {
    let getNext = false;
    for (const v of list) {
      if (getNext) {
        return v;
      }
      if (id == v.id) {
        getNext = true;
      }
    }
  }
</script>

<!-- <div
  class="fixed left-0 top-0 z-50 h-48 w-48 sm:bg-green-500 md:bg-red-500 lg:bg-yellow-500 xl:bg-blue-500 2xl:bg-purple-500" /> -->

<div class="flex h-screen max-h-screen min-h-screen flex-col bg-zinc-950">
  <div class="flex h-[8%] place-content-between bg-zinc-900 p-3">
    <a href="/" class="my-auto text-3xl font-bold tracking-tight text-white">boringtube</a>
    <div class="flex gap-5">
      <button
        class="rounded-md bg-zinc-800 px-5 text-zinc-500 transition duration-200 hover:bg-zinc-700"
        on:click={signOut}>Logout</button>
    </div>
  </div>

  <div class="flex h-[92%]">
    <div class="flex md:w-4/12 2xl:w-3/12">
      <div class="flex w-20 flex-col gap-3 overflow-scroll bg-zinc-950 px-3 py-3">
        {#if $channelsQuery.data}
          {#each $channelsQuery.data as subscription}
            <button
              on:click={() => {
                currentChannel = currentChannel?.id === subscription.id ? undefined : subscription;
                const feedList = document.getElementById('feedList');
                if (feedList) {
                  feedList.scrollTop = 0;
                }
              }}
              class="{currentChannel?.id === subscription.id
                ? 'opacity-100'
                : 'opacity-70'} transition duration-200 hover:opacity-100">
              <img
                src={subscription.snippet.thumbnails.default.url}
                alt="channel avatar"
                class={currentChannel?.id === subscription.id
                  ? 'rounded-full border-2 border-green-500'
                  : 'rounded-full'} />
            </button>
          {/each}
        {/if}
      </div>

      <div
        class="relative flex flex-1 flex-col overflow-scroll bg-zinc-950 px-3 pb-3"
        id="feedList">
        <div class="sticky top-0 z-50 flex flex-col gap-2 bg-zinc-950 py-5">
          <div class="flex gap-2">
            <FilterButton
              selected={view === 'NEW'}
              on:click={() => {
                view = 'NEW';
              }}>New</FilterButton>

            <FilterButton
              selected={view === 'WATCH_LATER'}
              on:click={() => {
                view = 'WATCH_LATER';
              }}>Watch Later</FilterButton>

            <FilterButton
              selected={view === 'ARCHIVED'}
              on:click={() => {
                view = 'ARCHIVED';
              }}>Archived</FilterButton>

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
                <IconTrash />
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
                  <IconX />
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
            <IconLoading />
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
                      <IconClock />
                    </button>
                  {/if}

                  <button
                    class=" hidden w-8 rounded-md p-1 text-zinc-700 hover:bg-zinc-900 group-hover:block"
                    on:click|stopPropagation={() => {
                      if (view === 'NEW' || view === 'WATCH_LATER') archiveVideo(video);
                      else unarchiveVideo(video);
                    }}>
                    {#if view === 'NEW' || view === 'WATCH_LATER'}
                      <IconTrash />
                    {:else}
                      <IconRestore />
                    {/if}
                  </button>
                </div>
              </button>
            {:else}
              <div class="m-auto text-center flex-col flex place-content-center">
                <p class="mt-10 text-2xl">😭</p>
                <p class="text-zinc-500">There's nothing here</p>
              </div>
            {/each}

            {#if view === 'NEW' && viewingVideoList.length > 0}
              <div bind:this={lastItem}>
                <button class="rounded-full bg-zinc-800 px-4 py-2 text-white">More...</button>
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
          <div class={theaterMode ? 'h-full w-full' : 'flex h-4/5 w-full'}>
            <img src={currentVideo.thumbnail} alt="video thumbnail" class="m-auto" />
            <button
              class="absolute top-0 bg-black opacity-70 {theaterMode
                ? 'h-full w-full'
                : 'h-4/5 w-full'}"
              on:click={() => {
                playing = true;
              }}>
              <div class=" m-auto h-full w-2/12">
                <IconPlay />
              </div>
            </button>
          </div>
        {/if}

        <div class="mr-10 mt-3 flex place-content-between gap-2 {theaterMode ? 'ml-7' : ''}">
          <h2 class="flex-1 text-2xl font-bold text-white">{currentVideo.title}</h2>
          {#if currentVideo.status !== 'WATCH_LATER'}
            <Button
              variant="secondary"
              on:click={() => {
                if (currentVideo) {
                  watchLaterVideo(currentVideo);
                  currentVideo = getNextVideoInList(currentVideo.id, viewingVideoList);
                }
              }}>
              Watch Later
            </Button>
          {:else}
            <Button
              variant="secondary"
              on:click={() => {
                if (currentVideo) {
                  unwatchLaterVideo(currentVideo);
                  currentVideo = getNextVideoInList(currentVideo.id, viewingVideoList);
                }
              }}>
              Unsave
            </Button>
          {/if}

          {#if currentVideo.status !== 'ARCHIVED'}
            <Button
              variant="secondary"
              on:click={() => {
                if (currentVideo) {
                  archiveVideo(currentVideo);
                  currentVideo = getNextVideoInList(currentVideo.id, viewingVideoList);
                }
              }}>
              Archive
            </Button>
          {:else}
            <Button
              variant="secondary"
              on:click={() => {
                if (currentVideo) {
                  unarchiveVideo(currentVideo);
                  currentVideo = getNextVideoInList(currentVideo.id, viewingVideoList);
                }
              }}>
              Unarchive
            </Button>
          {/if}

          {#if theaterMode}
            <Button
              variant="secondary"
              on:click={() => {
                theaterMode = false;
              }}>Exit Theater Mode</Button>
          {:else}
            <Button
              variant="secondary"
              on:click={() => {
                theaterMode = true;
              }}>Enable Theather Mode</Button>
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
      {:else}
        <div class="flex h-full place-items-center">
          <p class="w-full text-center text-zinc-500">Select a video to start watching</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<dialog id="archiveAllConfirmation" class="rounded-lg bg-zinc-900 p-5 text-white">
  <form>
    <h1 class="text-2xl font-bold">Archive All</h1>
    <p class="text-zinc-300">Are you sure you want to archive all new videos in your feed?</p>
    <div class="mt-5 flex place-content-end gap-3">
      <Button variant="danger" on:click={archiveAll}>Yes, archive all</Button>
      <Button variant="secondary" value="cancel">Cancel</Button>
    </div>
  </form>
</dialog>
