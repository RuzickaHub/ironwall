// main.js
(() => {
  'use strict';
  const API = '?api=1';
  const grid = document.getElementById('grid');
  const uploadInput = document.getElementById('upload');
  const uploadModal = document.getElementById('upload-modal');
  const progressCircle = document.getElementById('progress-circle');
  const progressText = document.getElementById('progress-text');
  const uploadFname = document.getElementById('upload-fname');
  const uploadStatus = document.getElementById('upload-status');
  // const refreshBtn = document.getElementById('refresh'); // Odstraněno
  const toggleThemeBtn = document.getElementById('toggle-theme');

  // modal elements
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modal-body');
  const layer1 = document.getElementById('layer1');
  const layer2 = document.getElementById('layer2');
  const spinner1 = document.getElementById('spinner1');
  const spinner2 = document.getElementById('spinner2');
  const imgA = layer1.querySelector('img');
  const imgB = layer2.querySelector('img');

  let items = [];
  let currentIndex = 0;
  let activeImg = imgA;
  let bufferImg = imgB;
  let activeSpinner = spinner1;
  let bufferSpinner = spinner2;
  let isShown = false;
  let bgLayers = Array.from(document.querySelectorAll('.bg-layer'));
  let bgLoopInterval = null; // ID pro interval pozadí

  // feather icons (načteno z CDN v index.php)
  if (window.feather) feather.replace();
  
  // Custom: Zastaví cyklické přechody pozadí
  function stopBgLoop() {
      if (bgLoopInterval) {
          clearInterval(bgLoopInterval);
          bgLoopInterval = null;
      }
      // Vynuluje zobrazení vrstev
      bgLayers.forEach((b)=> b.classList.remove('show'));
  }

  // THEME: light/dark saved to localStorage
  function applyTheme(theme) {
    document.body.classList.remove('light','dark');
    document.body.classList.add(theme === 'light' ? 'light' : 'dark');
    const icon = theme === 'light' ? 'sun' : 'moon';
    toggleThemeBtn.innerHTML = `<svg data-feather="${icon}" class="w-4 h-4"></svg>`;
    if (window.feather) feather.replace();
    localStorage.setItem('ui-theme', theme);
    
    // Custom: Kontrola pozadí - pozadí se pouští pouze v dark režimu
    if (theme === 'dark') {
        startBgLoop();
    } else {
        stopBgLoop();
    }
  }
  toggleThemeBtn.addEventListener('click', () => {
    const cur = localStorage.getItem('ui-theme') || 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });
  const savedTheme = localStorage.getItem('ui-theme') || 'dark';
  

  // ---------- Load list ----------
  async function loadList() {
    grid.innerHTML = Array.from({length:8}).map(()=>'<div class="skeleton"></div>').join('');
    try {
      const res = await fetch(API);
      items = await res.json();
      renderGrid();
      // Spustí pozadí, pokud je aktivní dark motiv (pro případ prvního načtení)
      if (document.body.classList.contains('dark')) {
          startBgLoop();
      }
    } catch (e) {
      console.error(e);
      grid.innerHTML = '<div class="p-8 rounded bg-red-600/10">Chyba při načítání</div>';
    }
  }

  function renderGrid() {
    if (!items.length) {
      grid.innerHTML = `<div class="p-8 rounded bg-white/4 text-center">Žádné obrázky — nahraj první.</div>`;
      return;
    }
    grid.innerHTML = '';
    items.forEach((it, i) => {
      const el = document.createElement('div');
      el.className = 'thumb card';
      el.innerHTML = `<img data-src="${it.url}" alt="${escapeHtml(it.name)}" loading="lazy" class="not-loaded">` +
                     `<div class="meta">${formatSize(it.size)}</div>`;
      el.addEventListener('click', () => openModal(i));
      grid.appendChild(el);
    });
    lazyLoadThumbnails();
  }

  function lazyLoadThumbnails() {
    const imgs = document.querySelectorAll('.thumb img');
    const io = new IntersectionObserver((entries, obs) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const im = e.target;
        const src = im.getAttribute('data-src');
        if (!src) { obs.unobserve(im); continue; }
        im.src = src;
        im.onload = () => { im.classList.remove('not-loaded'); im.classList.add('loaded'); };
        im.onerror = () => { im.classList.remove('not-loaded'); im.classList.add('loaded'); im.alt = 'Nelze načíst'; };
        obs.unobserve(im);
      }
    }, { rootMargin: '120px' });
    imgs.forEach(i => io.observe(i));
  }

  // ---------- Modal open/close & morph ----------
  function openModal(index) {
    if (!items[index]) return;
    currentIndex = index;
    setLayer(activeImg, items[index].url, true);
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    isShown = true;
    preload((currentIndex + 1) % items.length);
    preload((currentIndex - 1 + items.length) % items.length);
  }

  function closeModal() {
    modal.classList.remove('show');
    document.body.style.overflow = '';
    isShown = false;
    setTimeout(()=> {
      layer1.classList.remove('show');
      layer2.classList.remove('show');
      activeImg.src = '';
      bufferImg.src = '';
      spinner1.classList.remove('show');
      spinner2.classList.remove('show');
    }, 360);
  }

  function setLayer(imgEl, src, makeActive=false) {
    const parent = imgEl.parentElement;
    const spinner = (imgEl === imgA) ? spinner1 : spinner2;
    parent.classList.remove('show');
    spinner.classList.add('show');
    imgEl.src = src;
    imgEl.style.transform = 'scale(1.02)';
    imgEl.onload = () => {
      adjustModalSize(imgEl.naturalWidth || 1, imgEl.naturalHeight || 1);
      parent.classList.add('show');
      spinner.classList.remove('show');
      imgEl.style.transform = 'scale(1)';
      if (makeActive) {
        activeImg = imgEl;
        bufferImg = (imgEl === imgA) ? imgB : imgA;
        activeSpinner = spinner;
        bufferSpinner = (spinner === spinner1) ? spinner2 : spinner1;
      }
    };
    imgEl.onerror = () => {
      parent.classList.add('show');
      spinner.classList.remove('show');
      imgEl.alt = 'Chyba načtení';
    };
  }

  function morphTo(newIndex) {
    if (!items[newIndex]) return;
    // Set layer for the buffer image, don't make it active yet
    setLayer(bufferImg, items[newIndex].url, false);
    const buffSpinner = (bufferImg === imgA) ? spinner1 : spinner2;
    bufferImg.onload = () => {
      // Once buffer is loaded, crossfade
      bufferImg.parentElement.classList.add('show');
      activeImg.parentElement.classList.remove('show');
      buffSpinner.classList.remove('show');
      // "Morph" effect (small scale out)
      bufferImg.style.transform = 'scale(1.02)';
      setTimeout(()=> bufferImg.style.transform = 'scale(1)', 40);
      // Swap active and buffer
      [activeImg, bufferImg] = [bufferImg, activeImg];
      currentIndex = newIndex;
      // Preload next/prev images
      preload((currentIndex + 1) % items.length);
      preload((currentIndex - 1 + items.length) % items.length);
    };
  }

  function nextImage() { morphTo((currentIndex + 1) % items.length); }
  function prevImage() { morphTo((currentIndex - 1 + items.length) % items.length); }

  function downloadCurrent() {
    if (!items[currentIndex]) return;
    const a = document.createElement('a');
    a.href = items[currentIndex].url;
    a.download = items[currentIndex].name || '';
    document.body.appendChild(a); a.click(); a.remove();
  }

  function preload(idx) { if (!items[idx]) return; const i = new Image(); i.src = items[idx].url; }

  function adjustModalSize(nw, nh) {
    const vw = Math.min(window.innerWidth * 0.94, 1600); // 94vw max 1600px
    const vh = Math.min(window.innerHeight * 0.9, 1000);  // 90vh max 1000px
    const ratio = nw / nh;
    let w = vw, h = Math.round(w / ratio);
    if (h > vh) { h = vh; w = Math.round(h * ratio); }
    modalBody.style.width = w + 'px';
    modalBody.style.height = h + 'px';
  }

  // ---------- UPLOAD with aggregated progress ----------
  uploadInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
    let uploadedBytesSoFar = 0;
    let currentIndexUpload = 0;

    uploadFname.textContent = files[0].name || 'Nahrávání...';
    uploadStatus.textContent = `0 / ${files.length} • 0 B / ${formatSize(totalBytes)}`;
    uploadModal.classList.add('show');

    (async function seqUpload() {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        uploadFname.textContent = file.name;
        try {
          await uploadSingle(file, (loaded) => {
            // loaded = bytes loaded for current file
            const percent = Math.min(100, ((uploadedBytesSoFar + loaded) / totalBytes) * 100);
            setProgress(percent);
            uploadStatus.textContent = `${i} / ${files.length} • ${formatSize(Math.round(uploadedBytesSoFar + loaded))} / ${formatSize(totalBytes)}`;
          });
          // after file completed
          uploadedBytesSoFar += file.size;
          setProgress(Math.min(100, (uploadedBytesSoFar / totalBytes) * 100));
          uploadStatus.textContent = `${i+1} / ${files.length} • ${formatSize(uploadedBytesSoFar)} / ${formatSize(totalBytes)}`;
        } catch (err) {
          console.error(err);
          showToast('Chyba nahrávání: ' + (err.message || err), true);
        }
      }
      // finalize
      setProgress(100);
      setTimeout(()=> {
        uploadModal.classList.remove('show');
        setProgress(0);
        uploadInput.value = ''; // Reset input to allow re-uploading same file
        loadList();
      }, 600);
    })();
  });

  function uploadSingle(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API, true);
      const fd = new FormData();
      fd.append('file', file);
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(e.loaded);
        }
      });
      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            onProgress(file.size);
            resolve(res);
          } else {
            reject(new Error(res.error || 'Chyba při uploadu'));
          }
        } catch (err) {
          reject(err);
        }
      };
      xhr.onerror = () => reject(new Error('Síťová chyba'));
      xhr.send(fd);
    });
  }

  function setProgress(percent) {
    progressText.textContent = Math.round(percent) + '%';
    const r = 40;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (percent / 100) * circumference;
    progressCircle.style.strokeDasharray = circumference;
    progressCircle.style.strokeDashoffset = offset;
  }

  // ---------- bg rotation ----------
  function startBgLoop() {
    if (!bgLayers.length || bgLoopInterval) return; // Nespouštět, pokud už běží
    
    // Nastaví úvodní stav a načte URL obrázků
    bgLayers.forEach((b)=> {
      b.classList.remove('show');
      // Nastaví background-image z data-atributu
      if (!b.style.backgroundImage) {
        const url = b.getAttribute('data-bg-url');
        if (url) b.style.backgroundImage = `url('${url}')`;
      }
    });
    
    let idx = 0;
    bgLayers[idx].classList.add('show');
    
    bgLoopInterval = setInterval(()=> {
      const prev = idx;
      idx = (idx + 1) % bgLayers.length;
      bgLayers[prev].classList.remove('show');
      bgLayers[idx].classList.add('show');
    }, 6000 + Math.floor(Math.random()*3000));
  }
  
  // ---------- helpers ----------
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return Math.round(bytes/1024) + ' KB';
    return Math.round(bytes/(1024*1024)) + ' MB';
  }

  function escapeHtml(s){ return String(s).replace(/[&<>"'`=\/]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c; }); }

  function showToast(msg, err=false) {
    const t = document.createElement('div'); t.className='toast'; t.textContent = msg;
    if (err) t.style.background = 'rgba(200,40,40,0.95)';
    document.body.appendChild(t);
    setTimeout(()=> t.style.opacity = '0', 2400);
    setTimeout(()=> t.remove(), 3000);
  }

  // ---------- keyboard & swipe ----------
  document.addEventListener('keydown', (e) => {
    if (!isShown) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowRight') nextImage();
    if (e.key === 'ArrowLeft') prevImage();
    if (e.key === 'd') downloadCurrent();
  });

  (function attachSwipe(){
    let sx=0, dx=0, sy=0, dy=0;
    modalBody.addEventListener('touchstart', (e) => { if (e.touches.length === 1) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx=dy=0; } }, {passive:true});
    modalBody.addEventListener('touchmove', (e) => { if (e.touches.length === 1) { dx = e.touches[0].clientX - sx; dy = e.touches[0].clientY - sy; } }, {passive:true});
    modalBody.addEventListener('touchend', () => { if (Math.abs(dx) > 60 && Math.abs(dy) < 120) { if (dx < 0) nextImage(); else prevImage(); } sx=sy=dx=dy=0; }, {passive:true});
  })();

  // expose globals
  window.nextImage = nextImage;
  window.prevImage = prevImage;
  window.downloadCurrent = downloadCurrent;
  window.closeModal = closeModal;

  // init
  applyTheme(savedTheme); // Nastaví počáteční třídu motivu a spustí/zastaví pozadí
  loadList();
  if (window.feather) feather.replace();
})();