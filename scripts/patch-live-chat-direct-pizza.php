<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$search = <<<'PHP'
        $secondary = $preferredCategoryRecommendation['secondary']
            ?? $categoryRecommendation['secondary']
            ?? null;
        $categoryLabel = is_array($preferredCategoryRecommendation)
            ? trim((string) ($preferredCategoryRecommendation['category'] ?? ''))
            : (is_array($categoryRecommendation) ? trim((string) ($categoryRecommendation['category'] ?? '')) : '');
PHP;

$replace = <<<'PHP'
        $secondary = $preferredCategoryRecommendation['secondary']
            ?? $categoryRecommendation['secondary']
            ?? null;
        $categoryLabel = is_array($preferredCategoryRecommendation)
            ? trim((string) ($preferredCategoryRecommendation['category'] ?? ''))
            : (is_array($categoryRecommendation) ? trim((string) ($categoryRecommendation['category'] ?? '')) : '');

        if (
            str_contains($messageLower, 'pizza')
            && is_array($preferredCategoryRecommendation)
            && is_array($preferredCategoryRecommendation['dish'] ?? null)
        ) {
            $preferredDish = $preferredCategoryRecommendation['dish'];
            $preferredName = trim((string) ($preferredDish['name'] ?? ''));
            $preferredSecondary = is_array($preferredCategoryRecommendation['secondary'] ?? null)
                ? trim((string) (($preferredCategoryRecommendation['secondary']['name'] ?? '')))
                : '';

            if ($preferredName !== '') {
                if ($preferredSecondary !== '') {
                    return $trimmedReply."\n\nIf you want my honest pick from the pizza, I'd start with **{$preferredName}**. If you want a second option, **{$preferredSecondary}** is also a safe choice.";
                }

                return $trimmedReply."\n\nIf you want my honest pick from the pizza, I'd start with **{$preferredName}**.";
            }
        }
PHP;

if (! str_contains($content, $search)) {
    fwrite(STDERR, "Direct pizza anchor not found.\n");
    exit(1);
}

$content = str_replace($search, $replace, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched direct pizza override.\n";
