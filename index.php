<?php
// index.php
// AI-morph galerie — neuromorphic UI, ratio-aware modal, aggregated upload progress, spinner placeholder, light/dark mode
declare(strict_types=1);

// -----------------------------------------------------------------------------
// INCLUDES
// -----------------------------------------------------------------------------
require_once 'config.php';
require_once 'helpers.php';

// -----------------------------------------------------------------------------
// API: GET = list, POST = upload (no delete exposed)
// -----------------------------------------------------------------------------
if (isset($_GET['api'])) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    try {
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if ($method === 'GET') {
            global $UPLOAD_DIR;
            $files = scan_images($UPLOAD_DIR);
            $out = [];
            foreach ($files as $f) {
                $p = $UPLOAD_DIR . '/' . $f;
                // Kontrola existence souboru pro mime_content_type a filesize
                if (!is_file($p)) continue; 
                $out[] = [
                    'id' => $f,
                    'name' => $f,
                    'url' => base_url() . '/uploads/' . rawurlencode($f),
                    'size' => filesize($p),
                    'mime' => mime_content_type($p),
                ];
            }
            echo json_encode($out);
            exit;
        } elseif ($method === 'POST') {
            global $MAX_SIZE, $UPLOAD_DIR;
            if (empty($_FILES['file'])) throw new Exception('Soubor chybí');
            // Zpracování jednoho souboru (původní kód očekává jeden na XHR)
            $file = $_FILES['file'];
            if (!isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) throw new Exception('Chyba při nahrávání');
            if ($file['size'] > $MAX_SIZE) throw new Exception('Soubor překročil maximální velikost 50 MB');
            $tmpMime = @mime_content_type($file['tmp_name']) ?: '';
            if (!str_starts_with($tmpMime, 'image/')) throw new Exception('Neplatný typ souboru');
            
            // Bezpečné jméno souboru a unikátní prefix
            $safe = preg_replace('/[^a-zA-Z0-9\.\-_]/', '_', basename($file['name']));
            $uniq = bin2hex(random_bytes(6)) . '_' . $safe;
            $target = $UPLOAD_DIR . '/' . $uniq;

            if (!move_uploaded_file($file['tmp_name'], $target)) throw new Exception('Nepodařilo se uložit soubor');
            
            echo json_encode(['success' => true, 'id' => $uniq, 'url' => base_url() . '/uploads/' . rawurlencode($uniq), 'size' => filesize($target)]);
            exit;
        } else {
            throw new Exception('Nepodporovaná metoda');
        }
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => $e->getMessage()]);
        exit;
    }
}

// -----------------------------------------------------------------------------
// FRONTEND: prepare list and bg pool
// -----------------------------------------------------------------------------
global $UPLOAD_DIR;
$images = scan_images($UPLOAD_DIR);
shuffle($images);
// Vybere až 6 obrázků pro pozadí
$bgPool = array_slice($images, 0, min(6, max(1, count($images))));
?>
<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>AI-Morph Galerie — Neuromorphic</title>

<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/feather-icons"></script>

<link rel="stylesheet" href="styles.css" />

</head>
<body class="dark"> <div id="bg-wrap" aria-hidden="true">
  <?php foreach ($bgPool as $i => $b):
    $url = 'uploads/' . rawurlencode($b);
  ?>
    <div class="bg-layer" id="bg-<?php echo $i; ?>" data-bg-url="<?php echo $url; ?>"></div>
  <?php endforeach; ?>
</div>

<header class="w-full">
  <div class="container flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">AI-Morph Galerie</h1>
      <p class="text-sm text-gray-300/70">Neuromorphic UI · ratio-aware modal · AI-like morph</p>
    </div>

    <div class="flex items-center gap-3">
      <label id="upload-label" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/8 cursor-pointer card">
        <svg data-feather="upload" class="w-4 h-4"></svg>
        <span class="text-sm">Nahrát</span>
        <input id="upload" type="file" accept="image/*" multiple class="sr-only" />
      </label>

      <button id="toggle-theme" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/6 hover:bg-white/8 card" title="Přepnout motiv">
        <svg data-feather="moon" class="w-4 h-4"></svg>
      </button>

      </div>
  </div>
</header>

<main class="container mt-6">
  <div id="grid" class="grid"></div>
</main>

<footer class="container mt-10 mb-12 text-sm text-gray-300/70">
  © <?php echo date('Y'); ?> — Until Design Fluent
</footer>

<div id="modal" aria-hidden="true" role="dialog">
  <div id="modal-overlay" onclick="closeModal()"></div>
  <div id="modal-body" role="document" aria-label="Image preview">
    <div id="layer1" class="morph-layer">
      <img src="" alt="">
      <div class="layer-spinner" id="spinner1">⌛</div>
    </div>
    <div id="layer2" class="morph-layer">
      <img src="" alt="">
      <div class="layer-spinner" id="spinner2">⌛</div>
    </div>

    <div id="btn-close" class="ctrl" title="Zavřít" onclick="closeModal()"><svg data-feather="x" class="w-5 h-5"></svg></div>
    <div id="btn-prev" class="ctrl" title="Předchozí" onclick="prevImage()"><svg data-feather="chevron-left" class="w-5 h-5"></svg></div>
    <div id="btn-next" class="ctrl" title="Další" onclick="nextImage()"><svg data-feather="chevron-right" class="w-5 h-5"></svg></div>
    <div id="btn-download" class="ctrl" title="Stáhnout" onclick="downloadCurrent()"><svg data-feather="download" class="w-5 h-5"></svg></div>
  </div>
</div>

<div id="upload-modal" aria-hidden="true">
  <div class="upload-card card">
    <div>
      <div style="font-weight:700">Nahrávání souborů</div>
      <div id="upload-fname" style="opacity:.85;margin-top:6px;font-size:13px">Vyber soubory...</div>
      <div id="upload-status" style="opacity:.8;margin-top:8px;font-size:13px">0 / 0 • 0 B / 0 B</div>
    </div>

    <div style="display:flex;align-items:center;gap:12px">
      <div class="progress-wrap" aria-hidden="true">
        <svg class="progress-svg" width="108" height="108" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" stroke="rgba(255,255,255,0.12)" stroke-width="10" fill="none"></circle>
          <circle id="progress-circle" cx="50" cy="50" r="40" stroke="#ffffff" stroke-width="10" stroke-linecap="round" fill="none" stroke-dasharray="251.2" stroke-dashoffset="251.2"></circle>
        </svg>
        <div class="progress-text" id="progress-text">0%</div>
      </div>
    </div>
  </div>
</div>

<script src="main.js"></script>

</body>
</html>