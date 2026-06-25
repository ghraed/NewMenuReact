<?php

$path = '/root/new_menu/NewMenuAPI/app/Http/Controllers/ChatController.php';
$content = file_get_contents($path);
if ($content === false) {
    fwrite(STDERR, "Failed to read ChatController.\n");
    exit(1);
}

$search = <<<'PHP'
            $aliases = [$key];
            if (str_ends_with($key, 'ies')) {
                $aliases[] = substr($key, 0, -3).'y';
            } elseif (str_ends_with($key, 'es')) {
                $aliases[] = substr($key, 0, -2);
            } elseif (str_ends_with($key, 's')) {
                $aliases[] = substr($key, 0, -1);
            }
PHP;

$replace = <<<'PHP'
            $aliases = [$key];
            if (str_ends_with($key, 'ies')) {
                $aliases[] = substr($key, 0, -3).'y';
            } elseif (str_ends_with($key, 'es')) {
                $aliases[] = substr($key, 0, -2);
            } elseif (str_ends_with($key, 's')) {
                $aliases[] = substr($key, 0, -1);
            }

            $parts = array_values(array_filter(explode(' ', $key)));
            if ($parts !== []) {
                $aliases[] = end($parts);
            }
PHP;

if (! str_contains($content, $search)) {
    fwrite(STDERR, "Category alias block not found.\n");
    exit(1);
}

$content = str_replace($search, $replace, $content);

if (file_put_contents($path, $content) === false) {
    fwrite(STDERR, "Failed to write ChatController.\n");
    exit(1);
}

echo "Patched category alias matching.\n";
