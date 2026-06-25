<?php

$chatControllerPath = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$deepSeekPath = '/root/new_menu/NewMenuAPI/app/Services/DeepSeekChatService.php';

$chatController = file_get_contents($chatControllerPath);
if ($chatController === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$chatControllerSearch = <<<'PHP'
                return [
                    'name' => trim((string) $dish->name),
                    'category' => trim((string) ($dish->category ?? 'Uncategorized')),
                    'price' => number_format((float) $dish->price, 2, '.', ''),
                    'description' => trim((string) ($dish->description ?? '')),
                    'ingredients' => $ingredients,
                ];
PHP;

$chatControllerReplace = <<<'PHP'
                return [
                    'name' => trim((string) $dish->name),
                    'category' => trim((string) ($dish->category ?? 'Uncategorized')),
                    'price' => number_format((float) $dish->price, 2, '.', ''),
                    'description' => trim((string) ($dish->description ?? '')),
                    'ingredients' => $ingredients,
                    'recommendation_priority' => $dish->is_profitable ? 'preferred' : 'standard',
                ];
PHP;

if (! str_contains($chatController, $chatControllerSearch)) {
    fwrite(STDERR, "ChatController pattern not found.\n");
    exit(1);
}

$chatController = str_replace($chatControllerSearch, $chatControllerReplace, $chatController);

if (file_put_contents($chatControllerPath, $chatController) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

$deepSeek = file_get_contents($deepSeekPath);
if ($deepSeek === false) {
    fwrite(STDERR, "Failed to read DeepSeekChatService.\n");
    exit(1);
}

$typeSearch = <<<'PHP'
     *   menu_items?:array<int,array{
     *     name:string,
     *     category:string,
     *     price:string,
     *     description:string,
     *     ingredients:array<int,string>
     *   }>
PHP;

$typeReplace = <<<'PHP'
     *   menu_items?:array<int,array{
     *     name:string,
     *     category:string,
     *     price:string,
     *     description:string,
     *     ingredients:array<int,string>,
     *     recommendation_priority?:string
     *   }>
PHP;

$menuItemsSearch = <<<'PHP'
        /** @var array<int,array{name:string,category:string,price:string,description:string,ingredients:array<int,string>}> $menuItems */
PHP;

$menuItemsReplace = <<<'PHP'
        /** @var array<int,array{name:string,category:string,price:string,description:string,ingredients:array<int,string>,recommendation_priority?:string}> $menuItems */
PHP;

$lineSearch = <<<'PHP'
                $ingredients = array_values(array_filter(
                    is_array($item['ingredients'] ?? null) ? $item['ingredients'] : [],
                    fn ($ingredient): bool => is_string($ingredient) && trim($ingredient) !== ''
                ));

                $ingredientText = $ingredients === []
                    ? 'unknown'
                    : implode(', ', array_slice($ingredients, 0, 12));

                $line = sprintf(
                    '- %s | category: %s | price: %s | ingredients: %s',
                    $name !== '' ? $name : 'Unnamed dish',
                    $category,
                    $price,
                    $ingredientText
                );
PHP;

$lineReplace = <<<'PHP'
                $ingredients = array_values(array_filter(
                    is_array($item['ingredients'] ?? null) ? $item['ingredients'] : [],
                    fn ($ingredient): bool => is_string($ingredient) && trim($ingredient) !== ''
                ));

                $recommendationPriority = trim((string) ($item['recommendation_priority'] ?? 'standard'));

                $ingredientText = $ingredients === []
                    ? 'unknown'
                    : implode(', ', array_slice($ingredients, 0, 12));

                $line = sprintf(
                    '- %s | category: %s | price: %s | ingredients: %s | recommendation_priority: %s',
                    $name !== '' ? $name : 'Unnamed dish',
                    $category,
                    $price,
                    $ingredientText,
                    $recommendationPriority !== '' ? $recommendationPriority : 'standard'
                );
PHP;

$promptSearch = <<<'PHP'
            '3) Suggest complete meals and upsell suitable drinks/sides naturally.',
            '4) Support Arabic, English, and French. Use language: '.$lang.'. If auto, infer from user message.',
            '5) Allergy safety: if the guest mentions an allergy, acknowledge it, avoid unsafe suggestions, and suggest safer alternatives.',
            '6) Before finalizing any order, explicitly confirm the items and quantities with the guest.',
            '7) Never invent dishes or prices that are not in the provided menu data.',
PHP;

$promptReplace = <<<'PHP'
            '3) Suggest complete meals and upsell suitable drinks/sides naturally.',
            '4) When the guest asks what exists in a category or asks for a recommendation, do not only list items. After the list, add one short natural recommendation.',
            '5) Prefer items marked with recommendation_priority: preferred when they fit the request, but never mention profitability, internal ranking, marketing, or margins.',
            '6) Keep recommendations honest and human. Example tone: "If you want my honest pick, I would start with..."',
            '7) Support Arabic, English, and French. Use language: '.$lang.'. If auto, infer from user message.',
            '8) Allergy safety: if the guest mentions an allergy, acknowledge it, avoid unsafe suggestions, and suggest safer alternatives.',
            '9) Before finalizing any order, explicitly confirm the items and quantities with the guest.',
            '10) Never invent dishes or prices that are not in the provided menu data.',
PHP;

foreach ([
    [$typeSearch, $typeReplace, 'type block'],
    [$menuItemsSearch, $menuItemsReplace, 'menuItems annotation'],
    [$lineSearch, $lineReplace, 'menu line block'],
    [$promptSearch, $promptReplace, 'prompt rules'],
] as [$search, $replace, $label]) {
    if (! str_contains($deepSeek, $search)) {
        fwrite(STDERR, "DeepSeek pattern not found: {$label}.\n");
        exit(1);
    }

    $deepSeek = str_replace($search, $replace, $deepSeek);
}

if (file_put_contents($deepSeekPath, $deepSeek) === false) {
    fwrite(STDERR, "Failed to write DeepSeekChatService.\n");
    exit(1);
}

echo "Patched live chat backend files.\n";
