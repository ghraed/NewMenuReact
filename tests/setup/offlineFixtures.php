<?php

if (($argv[1] ?? 'create') === 'create') {
    ob_start();
    require __DIR__.'/lifecycleFixtures.php';
    $data = json_decode(ob_get_clean(), true, flags: JSON_THROW_ON_ERROR);
    $data['b']['slug'] = App\Models\Restaurant::findOrFail($data['b']['id'])->slug;
    echo json_encode($data, JSON_THROW_ON_ERROR);

    return;
}
require getenv('QA_API_ROOT').'/scripts/qa/bootstrap.php';
if (getenv('DB_DATABASE') !== 'menu_test_QA_RUN_'.getenv('QA_RUN_ID').'_browser') {
    throw new RuntimeException('Offline fixtures require the owned browser database.');
}
$admin = App\Models\User::where('email', getenv('PLAYWRIGHT_PROFILE_EMAIL'))->firstOrFail();
$restaurant = $admin->restaurant()->firstOrFail();
$action = $argv[1];
if ($action === 'expire') {
    $restaurant->tableSessions()->update(['expires_at' => now()->subMinute()]);
} elseif ($action === 'close') {
    $restaurant->tableSessions()->update(['status' => 'closed', 'closed_at' => now()]);
} elseif ($action === 'disable') {
    $restaurant->features()->updateExistingPivot(App\Models\Feature::where('key', 'table_ordering')->firstOrFail()->id, ['enabled' => false]);
} elseif ($action === 'clear-cache') {
    Illuminate\Support\Facades\Cache::flush();
} elseif ($action !== 'snapshot') {
    throw new RuntimeException('Unsupported offline fixture action.');
}
echo json_encode(['orders' => App\Models\Order::where('restaurant_id', $restaurant->id)->get(['id', 'table_session_id', 'total'])->toArray(), 'invoices' => App\Models\Invoice::where('restaurant_id', $restaurant->id)->count(), 'foreign_orders' => App\Models\Order::where('restaurant_id', '!=', $restaurant->id)->count()], JSON_THROW_ON_ERROR);
