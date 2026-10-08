<?php

require getenv('QA_API_ROOT').'/scripts/qa/bootstrap.php';
if (getenv('DB_DATABASE') !== 'menu_test_QA_RUN_'.getenv('QA_RUN_ID').'_browser') {
    throw new RuntimeException('Lifecycle fixtures require the owned browser database.');
}
$prefix = 'QA_RUN_'.getenv('QA_RUN_ID').'_'.getenv('QA_SCENARIO_ID');
$admin = App\Models\User::where('email', getenv('PLAYWRIGHT_PROFILE_EMAIL'))->firstOrFail();
$a = $admin->restaurant()->firstOrFail();
$users = [];
foreach (['staff', 'chef', 'unassigned'] as $role) {
    $user = App\Models\User::factory()->state(['role' => $role === 'unassigned' ? 'staff' : $role])
        ->attachedToRestaurant($a)->create([
            'name' => $prefix.'_'.$role, 'email' => $prefix.'_'.$role.'@example.invalid',
            'password' => getenv('PLAYWRIGHT_PROFILE_PASSWORD'),
        ]);
    if ($role === 'staff') {
        $user->assignedTables()->attach($a->tables()->where('name', 'T01')->firstOrFail()->id);
    }
    $users[$role] = $user->email;
}
$bAdmin = App\Models\User::factory()->admin()->create([
    'name' => $prefix.'_B', 'email' => $prefix.'_B@example.invalid', 'password' => getenv('PLAYWRIGHT_PROFILE_PASSWORD'),
]);
$b = App\Models\Restaurant::factory()->for($bAdmin, 'user')->create([
    'name' => $prefix.'_B_restaurant', 'slug' => strtolower(str_replace('_', '-', $prefix)).'-b',
    'manual_table_count' => 10,
]);
foreach ($a->features as $feature) {
    $b->features()->attach($feature->id, ['enabled' => $feature->pivot->enabled && $feature->key !== 'table_ordering']);
}
$dish = App\Models\Dish::factory()->for($a)->create([
    'name' => $prefix.'_Grill', 'price' => '12.50', 'category' => 'Main Courses', 'status' => 'published',
]);
$foreignDish = App\Models\Dish::factory()->for($b)->create([
    'name' => $prefix.'_B_Grill', 'price' => '99.00', 'status' => 'published',
]);
// Reserved test hosts are used only as HTTP Host headers on loopback; no DNS/TLS provisioning.
$a->update(['custom_domain' => 'a-'.$a->id.'.qa.invalid', 'custom_domain_status' => 'active']);
$b->update(['custom_domain' => 'b-'.$b->id.'.qa.invalid', 'custom_domain_status' => 'active']);
$a->features()->updateExistingPivot(App\Models\Feature::where('key', 'custom_domain')->firstOrFail()->id, ['enabled' => true]);
echo json_encode([
    'a' => ['id' => $a->id, 'slug' => $a->slug, 'host' => $a->custom_domain, 'tableId' => $a->tables()->where('name', 'T01')->firstOrFail()->id],
    'b' => ['id' => $b->id, 'email' => $bAdmin->email, 'host' => $b->custom_domain, 'tableId' => $b->tables()->where('name', 'T01')->firstOrFail()->id],
    'users' => $users, 'dish' => ['id' => $dish->id, 'name' => $dish->name], 'foreignDishId' => $foreignDish->id,
    'flags' => ['a' => app(App\Services\FeatureFlagService::class)->flagsForRestaurant($a->fresh()), 'b' => app(App\Services\FeatureFlagService::class)->flagsForRestaurant($b->fresh())],
], JSON_THROW_ON_ERROR);
