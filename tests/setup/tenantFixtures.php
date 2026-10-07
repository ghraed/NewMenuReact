<?php

require getenv('QA_API_ROOT').'/scripts/qa/bootstrap.php';
if (getenv('DB_DATABASE') !== 'menu_test_QA_RUN_'.getenv('QA_RUN_ID').'_browser') {
    throw new RuntimeException('Tenant fixtures require this run\'s disposable browser schema.');
}
$prefix = 'QA_RUN_'.getenv('QA_RUN_ID').'_'.getenv('QA_SCENARIO_ID');
$adminA = App\Models\User::where('email', getenv('PLAYWRIGHT_PROFILE_EMAIL'))->firstOrFail();
$restaurantA = $adminA->restaurant()->firstOrFail();
$adminB = App\Models\User::factory()->admin()->create([
    'name' => $prefix.'_B_admin', 'email' => $prefix.'_B@example.invalid',
    'password' => getenv('PLAYWRIGHT_PROFILE_PASSWORD'),
]);
$restaurantB = App\Models\Restaurant::factory()->for($adminB, 'user')->create([
    'name' => $prefix.'_B_restaurant', 'slug' => strtolower(str_replace('_', '-', $prefix)).'-b',
    'manual_table_count' => 10,
]);
$accountantA = App\Models\User::factory()->accountant()->attachedToRestaurant($restaurantA)->create([
    'name' => $prefix.'_A_accountant', 'email' => $prefix.'_A_accountant@example.invalid',
    'password' => getenv('PLAYWRIGHT_PROFILE_PASSWORD'),
]);
$adminA2 = App\Models\User::factory()->admin()->attachedToRestaurant($restaurantA)->create([
    'name' => $prefix.'_A_second_admin', 'email' => $prefix.'_A_second_admin@example.invalid',
    'password' => getenv('PLAYWRIGHT_PROFILE_PASSWORD'),
]);
foreach ($restaurantA->features as $feature) {
    $restaurantB->features()->attach($feature->id, ['enabled' => $feature->pivot->enabled]);
}
echo json_encode([
    'a' => ['id' => $restaurantA->id, 'userId' => $adminA->id, 'name' => $adminA->name, 'email' => $adminA->email],
    'b' => ['id' => $restaurantB->id, 'userId' => $adminB->id, 'name' => $adminB->name, 'email' => $adminB->email],
    'accountant' => ['userId' => $accountantA->id, 'name' => $accountantA->name, 'email' => $accountantA->email],
    'adminA2' => ['userId' => $adminA2->id, 'name' => $adminA2->name, 'email' => $adminA2->email],
], JSON_THROW_ON_ERROR);
