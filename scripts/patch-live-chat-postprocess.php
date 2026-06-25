<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$assistantSearch = <<<'PHP'
        try {
            $assistant = $this->deepSeekChatService->chat($chatMessages, $resolvedLanguage, $chatContext);
        } catch (Throwable $e) {
PHP;

$assistantReplace = <<<'PHP'
        try {
            $assistant = $this->deepSeekChatService->chat($chatMessages, $resolvedLanguage, $chatContext);
            if (isset($assistant['reply']) && is_string($assistant['reply'])) {
                $assistant['reply'] = $this->appendNaturalRecommendation(
                    $assistant['reply'],
                    $message,
                    $chatContext
                );
            }
        } catch (Throwable $e) {
PHP;

if (! str_contains($content, $assistantSearch)) {
    fwrite(STDERR, "Assistant block pattern not found.\n");
    exit(1);
}

$content = str_replace($assistantSearch, $assistantReplace, $content);

$insertAfter = <<<'PHP'
    private function sanitizeConversationId(string $conversationId): string
    {
        $normalized = trim($conversationId);

        if ($normalized === '') {
            return 'default';
        }

        $normalized = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $normalized);
        if (! is_string($normalized)) {
            return 'default';
        }

        $normalized = trim($normalized, '-_');
        if ($normalized === '') {
            return 'default';
        }

        return substr($normalized, 0, 120);
    }
PHP;

$insertBlock = <<<'PHP'
    private function sanitizeConversationId(string $conversationId): string
    {
        $normalized = trim($conversationId);

        if ($normalized === '') {
            return 'default';
        }

        $normalized = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $normalized);
        if (! is_string($normalized)) {
            return 'default';
        }

        $normalized = trim($normalized, '-_');
        if ($normalized === '') {
            return 'default';
        }

        return substr($normalized, 0, 120);
    }

    /**
     * @param array{
     *   restaurant_id?:int,
     *   restaurant_name?:string,
     *   restaurant_slug?:string,
     *   table_id?:int,
     *   menu_items?:array<int,array{
     *     name:string,
     *     category:string,
     *     price:string,
     *     description:string,
     *     ingredients:array<int,string>,
     *     recommendation_priority?:string
     *   }>
     * } $chatContext
     */
    private function appendNaturalRecommendation(string $reply, string $message, array $chatContext): string
    {
        $trimmedReply = trim($reply);
        if ($trimmedReply === '') {
            return $reply;
        }

        $messageLower = Str::lower(trim($message));
        if ($messageLower === '') {
            return $reply;
        }

        $categoryRecommendation = $this->resolveCategoryRecommendation($messageLower, $chatContext);
        $isRecommendationIntent = preg_match(
            '/\b(recommend|suggest|best|popular|top|pairing)\b|what should i order|what do you recommend|chef\'?s pick|رشح|اقترح|شو بتنصح|شو أطلب|شو الاقوى|recommande|suggestion/ui',
            $message
        ) === 1;

        if ($categoryRecommendation === null && ! $isRecommendationIntent) {
            return $reply;
        }

        $candidate = $categoryRecommendation['dish'] ?? $this->resolveGlobalPreferredDish($chatContext);
        if (! is_array($candidate) || trim((string) ($candidate['name'] ?? '')) === '') {
            return $reply;
        }

        $candidateName = trim((string) $candidate['name']);
        $replyLower = Str::lower($trimmedReply);
        $candidateLower = Str::lower($candidateName);

        if (
            str_contains($replyLower, $candidateLower)
            && preg_match('/\b(recommend|suggest|honest pick|start with|go with|safe choice|strong pick|solid place to start|best pick|my pick|try)\b|ارشح|بنصح|اقترح|أنصح|recommande|je choisirais/ui', $trimmedReply) === 1
        ) {
            return $reply;
        }

        $secondary = $categoryRecommendation['secondary'] ?? null;
        $categoryLabel = is_array($categoryRecommendation) ? trim((string) ($categoryRecommendation['category'] ?? '')) : '';

        if (is_array($secondary) && trim((string) ($secondary['name'] ?? '')) !== '') {
            $secondaryName = trim((string) $secondary['name']);

            if ($categoryLabel !== '') {
                return $trimmedReply."\n\nIf you want my honest pick from the {$categoryLabel}, I'd start with **{$candidateName}**. If you want a second option, **{$secondaryName}** is also a safe choice.";
            }

            return $trimmedReply."\n\nIf you want my honest pick, I'd start with **{$candidateName}**. **{$secondaryName}** is also a good option if you want a second choice.";
        }

        if ($categoryLabel !== '') {
            return $trimmedReply."\n\nIf you want my honest pick from the {$categoryLabel}, I'd start with **{$candidateName}**.";
        }

        return $trimmedReply."\n\nIf you want my honest pick, I'd start with **{$candidateName}**.";
    }

    /**
     * @param array<string,mixed> $chatContext
     * @return array{name:string,category:string,price:string,description:string,ingredients:array<int,string>,recommendation_priority?:string}|null
     */
    private function resolveGlobalPreferredDish(array $chatContext): ?array
    {
        $menuItems = is_array($chatContext['menu_items'] ?? null) ? $chatContext['menu_items'] : [];
        foreach ($menuItems as $item) {
            if (
                is_array($item)
                && trim((string) ($item['recommendation_priority'] ?? '')) === 'preferred'
                && trim((string) ($item['name'] ?? '')) !== ''
            ) {
                return $item;
            }
        }

        return null;
    }

    /**
     * @param array<string,mixed> $chatContext
     * @return array{category:string,dish:array<string,mixed>,secondary?:array<string,mixed>}|null
     */
    private function resolveCategoryRecommendation(string $messageLower, array $chatContext): ?array
    {
        $menuItems = is_array($chatContext['menu_items'] ?? null) ? $chatContext['menu_items'] : [];
        $buckets = [];

        foreach ($menuItems as $item) {
            if (! is_array($item)) {
                continue;
            }

            $category = trim((string) ($item['category'] ?? ''));
            if ($category === '') {
                continue;
            }

            $key = Str::lower(preg_replace('/\s+/', ' ', $category));
            if (! is_string($key) || $key === '') {
                continue;
            }

            $aliases = [$key];
            if (str_ends_with($key, 'ies')) {
                $aliases[] = substr($key, 0, -3).'y';
            } elseif (str_ends_with($key, 'es')) {
                $aliases[] = substr($key, 0, -2);
            } elseif (str_ends_with($key, 's')) {
                $aliases[] = substr($key, 0, -1);
            }

            if (! isset($buckets[$key])) {
                $buckets[$key] = [
                    'category' => $category,
                    'aliases' => [],
                    'items' => [],
                ];
            }

            $buckets[$key]['aliases'] = array_values(array_unique(array_filter($aliases)));
            $buckets[$key]['items'][] = $item;
        }

        $bestBucket = null;
        foreach ($buckets as $bucket) {
            $matches = false;
            foreach ($bucket['aliases'] as $alias) {
                if ($alias !== '' && str_contains($messageLower, $alias)) {
                    $matches = true;
                    break;
                }
            }

            if (! $matches) {
                continue;
            }

            $preferredCount = count(array_filter(
                $bucket['items'],
                fn (array $item): bool => trim((string) ($item['recommendation_priority'] ?? '')) === 'preferred'
            ));

            if (
                $bestBucket === null
                || $preferredCount > $bestBucket['preferred_count']
                || ($preferredCount === $bestBucket['preferred_count'] && count($bucket['items']) > count($bestBucket['items']))
            ) {
                $bestBucket = [
                    'category' => $bucket['category'],
                    'items' => $bucket['items'],
                    'preferred_count' => $preferredCount,
                ];
            }
        }

        if ($bestBucket === null) {
            return null;
        }

        $preferredItems = array_values(array_filter(
            $bestBucket['items'],
            fn (array $item): bool => trim((string) ($item['recommendation_priority'] ?? '')) === 'preferred'
        ));

        $candidateItems = $preferredItems !== [] ? $preferredItems : $bestBucket['items'];
        $primary = $candidateItems[0] ?? null;
        if (! is_array($primary)) {
            return null;
        }

        $secondaryPool = array_values(array_filter(
            $bestBucket['items'],
            fn (array $item): bool => trim((string) ($item['name'] ?? '')) !== trim((string) ($primary['name'] ?? ''))
        ));

        return [
            'category' => (string) $bestBucket['category'],
            'dish' => $primary,
            ...(($secondaryPool[0] ?? null) && is_array($secondaryPool[0]) ? ['secondary' => $secondaryPool[0]] : []),
        ];
    }
PHP;

if (! str_contains($content, $insertAfter)) {
    fwrite(STDERR, "Insert anchor not found.\n");
    exit(1);
}

$content = str_replace($insertAfter, $insertBlock, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched ChatController post-processing.\n";
