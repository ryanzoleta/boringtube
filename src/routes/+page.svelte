<script lang="ts">
  import { page } from '$app/stores';
  import { signIn } from '@auth/sveltekit/client';
  import { fade, slide, fly, blur } from 'svelte/transition';

  let show = false;

  setInterval(() => {
    show = true;
  }, 0);
</script>

<main class="flex min-h-screen flex-col place-items-center bg-black">
  {#if show}
    <div class=" mt-36 flex w-8/12 flex-col gap-10" in:fade>
      <div>
        <h1 class="mb-5 text-center text-xl font-bold text-zinc-500 md:text-3xl">boringtube</h1>
        <h3 class="text-center text-3xl font-bold tracking-tight text-white md:text-6xl">
          A minimalist YouTube interface without the algorithms
        </h3>
      </div>
      <div class="mx-auto flex gap-2">
        {#if $page.data.session}
          <a
            href="/app"
            class="w-fit rounded-md bg-red-500 px-4 py-2 font-bold text-white transition duration-100 hover:bg-red-600"
            >Open App</a>
        {/if}

        <button
          class="w-fit rounded-md bg-red-500 px-4 py-2 font-bold text-white transition duration-100 hover:bg-red-600"
          on:click={() => {
            signIn('google', { callbackUrl: '/app' });
          }}>Sign In to Google</button>
      </div>
      <div>
        <p class="text-center text-zinc-500">
          This is a free and open-source project I started as a way to learn frontend web
          development with SvelteKit
        </p>
        <p class="text-center text-zinc-500">
          Source code available at <a
            href="https://github.com/ryanzoleta/boringtube"
            target="_blank"
            class="underline hover:text-zinc-400">GitHub</a>
        </p>
      </div>
    </div>
  {/if}
</main>
