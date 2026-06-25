<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$search = <<<'PHP'
        if (
            str_contains($replyLower, $candidateLower)
            && preg_match('/\b(recommend|suggest|honest pick|start with|go with|safe choice|strong pick|solid place to start|best pick|my pick|try)\b|ارشح|بنصح|اقترح|أنصح|recommande|je choisirais/ui', $trimmedReply) === 1
        ) {
            return $reply;
        }
PHP;

$replace = <<<'PHP'
        if (
            str_contains($replyLower, $candidateLower)
            && (
                str_contains($replyLower, 'honest pick')
                || str_contains($replyLower, 'start with')
                || str_contains($replyLower, 'go with')
                || str_contains($replyLower, 'safe choice')
            )
        ) {
            return $reply;
        }
PHP;

if (! str_contains($content, $search)) {
    fwrite(STDERR, "Skip-check block not found.\n");
    exit(1);
}

$content = str_replace($search, $replace, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched skip-check block.\n";
