<?php

require getenv('QA_API_ROOT').'/scripts/qa/bootstrap.php';
if (getenv('QA_OPERATIONAL') !== '1') {
    throw new RuntimeException('Replay requires owned local realtime transport.');
}
$payload = json_decode(stream_get_contents(STDIN), true, flags: JSON_THROW_ON_ERROR);
$order = App\Models\Order::findOrFail($payload['id']);
if (! str_starts_with($order->restaurant->name, 'QA_RUN_'.getenv('QA_RUN_ID').'_')) {
    throw new RuntimeException('Replay requires this run\'s synthetic order.');
}
// Deliver the same real application event twice through Reverb, without intercepting API responses.
for ($i = 0; $i < 2; $i++) {
    event(new App\Events\KitchenOrderCreated($order, $payload));
}
