<script>
  let { store } = $props();
</script>

<div class="toast" class:show={store.toastVisible} id="toast">
  {store.toastMsg}
</div>