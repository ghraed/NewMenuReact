<?php

require getenv('QA_API_ROOT').'/scripts/qa/bootstrap.php';
if (getenv('DB_DATABASE') !== 'menu_test_QA_RUN_'.getenv('QA_RUN_ID').'_browser') {
    throw new RuntimeException('Policy fixtures require this run\'s disposable browser schema.');
}
$status = $argv[1] ?? '';
if (! in_array($status, ['active', 'inactive'], true)) {
    throw new RuntimeException('Unsupported QA lifecycle status.');
}
$user = App\Models\User::where('email', getenv('PLAYWRIGHT_PROFILE_EMAIL'))->firstOrFail();
$restaurant = $user->restaurant()->firstOrFail();
$restaurant->update(['status' => $status]);
echo json_encode([
    'status' => $restaurant->status,
    'slug' => $restaurant->slug,
    'orders' => $restaurant->orders()->count(),
    'invoices' => App\Models\Invoice::where('restaurant_id', $restaurant->id)->count(),
    'packaged_stock' => $restaurant->dishes()->sum('packaged_stock_quantity'),
], JSON_THROW_ON_ERROR);
