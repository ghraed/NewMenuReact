<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$search = <<<'PHP'
        $candidateName = trim((string) $candidate['name']);
        $replyLower = Str::lower($trimmedReply);
        $candidateLower = Str::lower($candidateName);
PHP;

$replace = <<<'PHP'
        $candidateName = trim((string) $candidate['name']);
        $trimmedReply = preg_replace('/\n\nIf you want (?:my honest pick|a solid place to start)[\s\S]*$/u', '', $trimmedReply) ?? $trimmedReply;
        $replyLower = Str::lower($trimmedReply);
        $candidateLower = Str::lower($candidateName);
PHP;

if (! str_contains($content, $search)) {
    fwrite(STDERR, "Recommendation override anchor not found.\n");
    exit(1);
}

$content = str_replace($search, $replace, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched recommendation override.\n";
