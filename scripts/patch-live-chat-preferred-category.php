<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$search = <<<'PHP'
        $categoryRecommendation = $this->resolveCategoryRecommendation($messageLower, $chatContext);
        $isRecommendationIntent = preg_match(
            '/\b(recommend|suggest|best|popular|top|pairing)\b|what should i order|what do you recommend|chef\'?s pick|رشح|اقترح|شو بتنصح|شو أطلب|شو الاقوى|recommande|suggestion/ui',
            $message
        ) === 1;

        if ($categoryRecommendation === null && ! $isRecommendationIntent) {
            return $reply;
        }

        $candidate = $categoryRecommendation['dish'] ?? $this->resolveGlobalPreferredDish($chatContext);
PHP;

$replace = <<<'PHP'
        $categoryRecommendation = $this->resolveCategoryRecommendation($messageLower, $chatContext);
        $preferredCategoryRecommendation = $this->resolvePreferredCategoryDish($messageLower, $chatContext);
        $isRecommendationIntent = preg_match(
            '/\b(recommend|suggest|best|popular|top|pairing)\b|what should i order|what do you recommend|chef\'?s pick|رشح|اقترح|شو بتنصح|شو أطلب|شو الاقوى|recommande|suggestion/ui',
            $message
        ) === 1;

        if ($categoryRecommendation === null && $preferredCategoryRecommendation === null && ! $isRecommendationIntent) {
            return $reply;
        }

        $candidate = $preferredCategoryRecommendation['dish']
            ?? $categoryRecommendation['dish']
            ?? $this->resolveGlobalPreferredDish($chatContext);
PHP;

if (! str_contains($content, $search)) {
    fwrite(STDERR, "Preferred category anchor not found.\n");
    exit(1);
}

$content = str_replace($search, $replace, $content);

$secondarySearch = <<<'PHP'
        $secondary = $categoryRecommendation['secondary'] ?? null;
        $categoryLabel = is_array($categoryRecommendation) ? trim((string) ($categoryRecommendation['category'] ?? '')) : '';
PHP;

$secondaryReplace = <<<'PHP'
        $secondary = $preferredCategoryRecommendation['secondary']
            ?? $categoryRecommendation['secondary']
            ?? null;
        $categoryLabel = is_array($preferredCategoryRecommendation)
            ? trim((string) ($preferredCategoryRecommendation['category'] ?? ''))
            : (is_array($categoryRecommendation) ? trim((string) ($categoryRecommendation['category'] ?? '')) : '');
PHP;

if (! str_contains($content, $secondarySearch)) {
    fwrite(STDERR, "Secondary/category anchor not found.\n");
    exit(1);
}

$content = str_replace($secondarySearch, $secondaryReplace, $content);

$insertAnchor = <<<'PHP'
    /**
     * @param array<string,mixed> $chatContext
     * @return array{name:string,category:string,price:string,description:string,ingredients:array<int,string>,recommendation_priority?:string}|null
     */
    private function resolveGlobalPreferredDish(array $chatContext): ?array
PHP;

$insertBlock = <<<'PHP'
    /**
     * @param array<string,mixed> $chatContext
     * @return array{category:string,dish:array<string,mixed>,secondary?:array<string,mixed>}|null
     */
    private function resolvePreferredCategoryDish(string $messageLower, array $chatContext): ?array
    {
        $menuItems = is_array($chatContext['menu_items'] ?? null) ? $chatContext['menu_items'] : [];
        $preferredItems = array_values(array_filter(
            $menuItems,
            fn (array $item): bool => trim((string) ($item['recommendation_priority'] ?? '')) === 'preferred'
        ));

        foreach ($preferredItems as $item) {
            $category = Str::lower(trim((string) ($item['category'] ?? '')));
            if ($category === '') {
                continue;
            }

            $aliases = [$category];
            $parts = array_values(array_filter(explode(' ', $category)));
            if ($parts !== []) {
                $aliases[] = end($parts);
            }

            $matches = false;
            foreach ($aliases as $alias) {
                if ($alias !== '' && str_contains($messageLower, $alias)) {
                    $matches = true;
                    break;
                }
            }

            if (! $matches) {
                continue;
            }

            $secondary = null;
            foreach ($menuItems as $candidate) {
                if (
                    trim((string) ($candidate['category'] ?? '')) === trim((string) ($item['category'] ?? ''))
                    && trim((string) ($candidate['name'] ?? '')) !== trim((string) ($item['name'] ?? ''))
                ) {
                    $secondary = $candidate;
                    break;
                }
            }

            return [
                'category' => (string) ($item['category'] ?? ''),
                'dish' => $item,
                ...($secondary && is_array($secondary) ? ['secondary' => $secondary] : []),
            ];
        }

        return null;
    }

    /**
     * @param array<string,mixed> $chatContext
     * @return array{name:string,category:string,price:string,description:string,ingredients:array<int,string>,recommendation_priority?:string}|null
     */
    private function resolveGlobalPreferredDish(array $chatContext): ?array
PHP;

if (! str_contains($content, $insertAnchor)) {
    fwrite(STDERR, "Preferred category insert anchor not found.\n");
    exit(1);
}

$content = str_replace($insertAnchor, $insertBlock, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched preferred category override.\n";
