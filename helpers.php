<?php
// helpers.php
declare(strict_types=1);

/**
 * Prohledá adresář a vrátí pole souborů obrázků.
 */
function scan_images(string $dir): array {
    $files = array_values(array_filter(scandir($dir), function($f) use ($dir) {
        // Kontrola, že to není '.' nebo '..', a že je to platný soubor s příponou obrázku.
        return !in_array($f, ['.','..']) && preg_match('/\.(jpe?g|png|webp|gif)$/i', $f) && is_file($dir . '/' . $f);
    }));
    return $files;
}

/**
 * Vytvoří základní URL adresu aplikace.
 */
function base_url(): string {
    $scheme = (isset($_SERVER['HTTPS']) && ($_SERVER['HTTPS'] === 'on' || $_SERVER['HTTPS'] === '1')) ||
              (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https')
              ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    // Odebere lomítka z konce cesty, ale ne pro kořen '/'
    $path = rtrim(dirname($_SERVER['REQUEST_URI']), '/\\');
    // Přidá zpět lomítko pro kořen, aby se cesta připojovala správně, pokud není na kořenu.
    return $scheme . '://' . $host . ($path === '/' ? '' : $path);
}