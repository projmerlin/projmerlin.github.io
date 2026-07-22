/*
 * Merlin — Memory Galaxy renderer.
 * Shared by demo.html's Board-lite "Memory Galaxy" pane and the standalone
 * "peek at Merlin's memory" section for standard-tier users.
 *
 * Requires THREE (global) to already be loaded, e.g.:
 *   <script src="https://unpkg.com/three@0.160.0/build/three.min.js"></script>
 *
 * Usage:
 *   const handle = MerlinGalaxy.mount(containerEl, { dataUrl: 'demo-galaxy.json' });
 *   // later, if the container is being removed/hidden:
 *   handle.dispose();
 */
(function (global) {
  'use strict';

  var ACCENT = 0x47c6ff;
  var ACCENT2 = 0x8a7bff;
  var LINK_COLOR = 0x7ad0ff;

  function supportsWebGL() {
    try {
      var canvas = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
      return false;
    }
  }

  function makeGlowTexture(hex) {
    var size = 128;
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var ctx = c.getContext('2d');
    var color = '#' + hex.toString(16).padStart(6, '0');
    var grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    var tex = new THREE.CanvasTexture(c);
    return tex;
  }

  function fallbackMessage(container, facts) {
    container.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'height:100%;min-height:220px;text-align:center;padding:22px;color:#9aa3bd;font-size:13.5px;' +
      'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">' +
      '<div style="font-size:26px;margin-bottom:10px;">✨</div>' +
      '<div style="color:#e8ecf7;font-weight:600;margin-bottom:6px;">Memory galaxy needs WebGL</div>' +
      '<div style="max-width:320px;">Your browser can\'t render the 3D view here, so a few of Merlin\'s ' +
      'remembered facts, plainly:</div>' +
      '<ul style="text-align:left;margin-top:10px;max-width:320px;padding-left:18px;">' +
      (facts || []).slice(0, 6).map(function (f) { return '<li style="margin:4px 0;">' + f + '</li>'; }).join('') +
      '</ul></div>';
  }

  function mount(container, options) {
    options = options || {};
    var dataUrl = options.dataUrl || 'demo-galaxy.json';

    if (!supportsWebGL() || typeof THREE === 'undefined') {
      fetch(dataUrl).then(function (r) { return r.json(); }).then(function (data) {
        fallbackMessage(container, (data.stars || []).map(function (s) { return s.fact; }));
      }).catch(function () {
        fallbackMessage(container, []);
      });
      return { dispose: function () {} };
    }

    container.innerHTML = '';
    container.style.position = container.style.position || 'relative';
    container.style.overflow = 'hidden';

    var width = Math.max(container.clientWidth, 40);
    var height = Math.max(container.clientHeight, 40);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.4);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);

    var group = new THREE.Group();
    scene.add(group);

    // ── distant starfield background ──
    (function buildStarfield() {
      var count = 900;
      var positions = new Float32Array(count * 3);
      for (var i = 0; i < count; i++) {
        var r = 6 + Math.random() * 6;
        var theta = Math.random() * Math.PI * 2;
        var phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.PointsMaterial({
        color: 0xaebbdd, size: 0.02, sizeAttenuation: true,
        transparent: true, opacity: 0.55, depthWrite: false
      });
      var field = new THREE.Points(geo, mat);
      scene.add(field);
    })();

    var starData = [];
    var starPointsObj = null;
    var linkLines = null;
    var raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.09;

    var loadPromise = fetch(dataUrl).then(function (r) { return r.json(); }).then(function (data) {
      starData = data.stars || [];
      var links = data.links || [];

      // ── memory stars ──
      var positions = new Float32Array(starData.length * 3);
      starData.forEach(function (s, i) {
        positions[i * 3] = s.pos[0] * 1.6;
        positions[i * 3 + 1] = s.pos[1] * 1.6;
        positions[i * 3 + 2] = s.pos[2] * 1.6;
      });
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var tex = makeGlowTexture(ACCENT);
      var mat = new THREE.PointsMaterial({
        map: tex, color: 0xffffff, size: 0.16, sizeAttenuation: true,
        transparent: true, opacity: 0.95, depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      starPointsObj = new THREE.Points(geo, mat);
      group.add(starPointsObj);

      // ── faint links between related stars ──
      var linkPositions = [];
      links.forEach(function (pair) {
        var a = starData[pair[0]], b = starData[pair[1]];
        if (!a || !b) return;
        linkPositions.push(a.pos[0] * 1.6, a.pos[1] * 1.6, a.pos[2] * 1.6);
        linkPositions.push(b.pos[0] * 1.6, b.pos[1] * 1.6, b.pos[2] * 1.6);
      });
      var lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linkPositions), 3));
      var lineMat = new THREE.LineBasicMaterial({
        color: LINK_COLOR, transparent: true, opacity: 0.28
      });
      linkLines = new THREE.LineSegments(lineGeo, lineMat);
      group.add(linkLines);
    }).catch(function () { /* silent — galaxy just renders empty starfield */ });

    // ── caption card ──
    var card = document.createElement('div');
    card.style.cssText = [
      'position:absolute', 'left:50%', 'bottom:14px', 'transform:translateX(-50%) translateY(12px)',
      'max-width:min(88%,340px)', 'background:rgba(122,152,199,.14)',
      'border:1px solid rgba(122,160,220,.32)', 'backdrop-filter:blur(10px)',
      '-webkit-backdrop-filter:blur(10px)', 'border-radius:12px', 'padding:10px 14px',
      'font-size:13px', 'color:#e8ecf7', 'line-height:1.5',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      'opacity:0', 'pointer-events:none', 'transition:opacity .2s ease, transform .2s ease', 'z-index:3'
    ].join(';');
    container.appendChild(card);
    var cardHideTimer = null;
    function showCard(text) {
      card.textContent = '✦ ' + text;
      card.style.opacity = '1';
      card.style.transform = 'translateX(-50%) translateY(0)';
      card.style.pointerEvents = 'auto';
      clearTimeout(cardHideTimer);
      cardHideTimer = setTimeout(hideCard, 6000);
    }
    function hideCard() {
      card.style.opacity = '0';
      card.style.transform = 'translateX(-50%) translateY(12px)';
      card.style.pointerEvents = 'none';
    }
    card.addEventListener('click', hideCard);

    // ── interaction: drag to rotate, wheel to zoom, click a star ──
    var dragging = false, lastX = 0, lastY = 0, moved = false;
    var rotY = 0.28, rotX = -0.15;
    group.rotation.x = rotX; group.rotation.y = rotY;
    var autoRotate = true;

    function onPointerDown(e) {
      dragging = true; moved = false; autoRotate = false;
      lastX = (e.touches ? e.touches[0].clientX : e.clientX);
      lastY = (e.touches ? e.touches[0].clientY : e.clientY);
      renderer.domElement.style.cursor = 'grabbing';
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var x = (e.touches ? e.touches[0].clientX : e.clientX);
      var y = (e.touches ? e.touches[0].clientY : e.clientY);
      var dx = x - lastX, dy = y - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) moved = true;
      rotY += dx * 0.005;
      rotX += dy * 0.005;
      rotX = Math.max(-1.2, Math.min(1.2, rotX));
      group.rotation.y = rotY;
      group.rotation.x = rotX;
      lastX = x; lastY = y;
    }
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
      setTimeout(function () { autoRotate = true; }, 2500);
      if (!moved) handleTap(e);
    }
    function handleTap(e) {
      if (!starPointsObj) return;
      var rect = renderer.domElement.getBoundingClientRect();
      var clientX = (e.changedTouches ? e.changedTouches[0].clientX : e.clientX);
      var clientY = (e.changedTouches ? e.changedTouches[0].clientY : e.clientY);
      var mouse = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      var hits = raycaster.intersectObject(starPointsObj);
      if (hits.length && starData[hits[0].index]) {
        showCard(starData[hits[0].index].fact);
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    renderer.domElement.addEventListener('touchstart', onPointerDown, { passive: true });
    renderer.domElement.addEventListener('touchmove', onPointerMove, { passive: true });
    renderer.domElement.addEventListener('touchend', endDrag);

    var minZ = 1.6, maxZ = 7;
    function onWheel(e) {
      e.preventDefault();
      camera.position.z += e.deltaY * 0.0018;
      camera.position.z = Math.max(minZ, Math.min(maxZ, camera.position.z));
    }
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });

    // ── resize handling (pane may be resized/dragged in Board-lite) ──
    var ro = null;
    function handleResize() {
      var w = Math.max(container.clientWidth, 40);
      var h = Math.max(container.clientHeight, 40);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    if (window.ResizeObserver) {
      ro = new ResizeObserver(handleResize);
      ro.observe(container);
    } else {
      window.addEventListener('resize', handleResize);
    }

    // ── render loop ──
    var raf = null;
    var disposed = false;
    function animate() {
      if (disposed) return;
      raf = requestAnimationFrame(animate);
      if (autoRotate) {
        rotY += 0.0011;
        group.rotation.y = rotY;
      }
      renderer.render(scene, camera);
    }
    animate();

    return {
      dispose: function () {
        disposed = true;
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', endDrag);
        renderer.dispose();
        if (renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      }
    };
  }

  global.MerlinGalaxy = { mount: mount };
})(window);
