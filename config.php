<?php
// config.php
declare(strict_types=1);

// Nastavení globální konfigurace aplikace
$UPLOAD_DIR = __DIR__ . '/uploads';
$MAX_SIZE = 50 * 1024 * 1024; // 50 MB per file

if (!is_dir($UPLOAD_DIR)) {
    mkdir($UPLOAD_DIR, 0755, true);
}