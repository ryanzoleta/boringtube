<script lang="ts">
  import { signIn } from '@auth/sveltekit/client';
</script>

<h1>Boringtube</h1>
<button
  class="rounded-md bg-red-500 px-4 py-2 text-white"
  on:click={() => {
    signIn('google');
  }}>Sign In to Google</button>
