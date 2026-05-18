// ─────────────────────────────────────────────
// 나마 시바이 — 앱 동작 로직
// ─────────────────────────────────────────────

(function() {
  'use strict';

  // ── 화면 요소 ──
  const screenCover = document.getElementById('screen-cover');
  const screenList = document.getElementById('screen-list');
  const screenReader = document.getElementById('screen-reader');

  const btnEnter = document.getElementById('btn-enter');
  const btnBackToCover = document.getElementById('btn-back-to-cover');
  const btnBackToList = document.getElementById('btn-back-to-list');
  const btnListBookmarks = document.getElementById('btn-list-bookmarks');
  const btnToggleBookmark = document.getElementById('btn-toggle-bookmark');
  const btnReaderSettings = document.getElementById('btn-reader-settings');
  const btnScrollTop = document.getElementById('btn-scroll-top');

  const listContent = document.getElementById('list-content');
  const readerContent = document.getElementById('reader-content');
  const readerTitle = document.getElementById('reader-title');

  const settingsMenu = document.getElementById('settings-menu');
  const settingsButtons = settingsMenu.querySelectorAll('button[data-setting]');
  const bookmarkMenu = document.getElementById('bookmark-menu');
  const bookmarkListContent = document.getElementById('bookmark-list-content');
  const bookmarkToast = document.getElementById('bookmark-toast');

  let currentSutraId = null;

  // ── 읽기 설정 (글꼴/크기/배경색) ──
  const settings = {
    font: localStorage.getItem('reader_font') || 'gyeonggi',
    size: localStorage.getItem('reader_size') || 'medium',
    bg: localStorage.getItem('reader_bg') || 'beige',
  };

  function applySettings() {
    // 기존 클래스 모두 정리
    const classesToRemove = [];
    readerContent.classList.forEach(cls => {
      if (cls.startsWith('font-') || cls.startsWith('size-') || cls.startsWith('bg-')) {
        classesToRemove.push(cls);
      }
    });
    classesToRemove.forEach(cls => readerContent.classList.remove(cls));

    // 새 클래스 적용
    readerContent.classList.add('font-' + settings.font);
    readerContent.classList.add('size-' + settings.size);
    readerContent.classList.add('bg-' + settings.bg);

    // 모달의 버튼 활성 상태 갱신
    settingsButtons.forEach(btn => {
      const setting = btn.getAttribute('data-setting');
      const value = btn.getAttribute('data-value');
      btn.classList.toggle('active', settings[setting] === value);
    });
  }

  function setSetting(setting, value) {
    settings[setting] = value;
    localStorage.setItem('reader_' + setting, value);
    applySettings();
  }

  // 모달의 모든 버튼에 클릭 이벤트
  settingsButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const setting = btn.getAttribute('data-setting');
      const value = btn.getAttribute('data-value');
      setSetting(setting, value);
    });
  });

  // ── 화면 전환 ──
  function showScreen(target) {
    [screenCover, screenList, screenReader].forEach(s => s.classList.remove('active'));
    target.classList.add('active');
    if (target === screenList) {
      updateBookmarkIndicator();
    }
  }

  btnEnter.addEventListener('click', () => showScreen(screenList));
  btnBackToCover.addEventListener('click', () => showScreen(screenCover));
  btnBackToList.addEventListener('click', () => showScreen(screenList));

  // ── HTML 이스케이프 ──
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ── 경전 목록 ──
  function buildList() {
    const byCategory = {};
    const categoryOrder = [];
    SUTRAS_DATA.forEach(sutra => {
      if (!byCategory[sutra.category]) {
        byCategory[sutra.category] = [];
        categoryOrder.push(sutra.category);
      }
      byCategory[sutra.category].push(sutra);
    });

    let html = '';
    categoryOrder.forEach(category => {
      html += `<div class="list-category">${escapeHtml(category)}</div>`;
      byCategory[category].forEach(sutra => {
        const subtitle = sutra.subtitle ? `<div class="list-item-subtitle">${escapeHtml(sutra.subtitle)}</div>` : '';
        html += `
          <div class="list-item" data-id="${escapeHtml(sutra.id)}">
            <div class="list-item-title">${escapeHtml(sutra.title)}</div>
            ${subtitle}
          </div>
        `;
      });
    });
    listContent.innerHTML = html;

    listContent.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.getAttribute('data-id');
        openSutra(id);
      });
    });
  }

  // ── 경전 펴기 ──
  function openSutra(id, scrollPos) {
    const sutra = SUTRAS_DATA.find(s => s.id === id);
    if (!sutra) {
      console.error('Sutra not found:', id);
      return;
    }
    readerTitle.textContent = sutra.title;
    readerContent.innerHTML = sutra.html;
    applySettings();
    currentSutraId = id;
    updateBookmarkToggleButton();

    const savedScroll = scrollPos !== undefined ? scrollPos : parseInt(localStorage.getItem('scroll_' + id) || '0');
    showScreen(screenReader);
    requestAnimationFrame(() => {
      readerContent.scrollTop = savedScroll;
    });
  }

  // ── 스크롤 위치 저장 ──
  let scrollSaveTimer = null;
  let bookmarkUpdateTimer = null;
  readerContent.addEventListener('scroll', () => {
    if (readerContent.scrollTop > 400) {
      btnScrollTop.classList.add('visible');
    } else {
      btnScrollTop.classList.remove('visible');
    }
    if (currentSutraId) {
      clearTimeout(scrollSaveTimer);
      scrollSaveTimer = setTimeout(() => {
        localStorage.setItem('scroll_' + currentSutraId, readerContent.scrollTop);
      }, 200);
    }
    clearTimeout(bookmarkUpdateTimer);
    bookmarkUpdateTimer = setTimeout(updateBookmarkToggleButton, 300);
  });

  btnScrollTop.addEventListener('click', () => {
    readerContent.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── 읽기 설정 모달 ──
  btnReaderSettings.addEventListener('click', () => settingsMenu.classList.add('active'));
  settingsMenu.addEventListener('click', e => {
    if (e.target === settingsMenu) settingsMenu.classList.remove('active');
  });

  // ───────────────────────────────────────
  // 책갈피
  // ───────────────────────────────────────
  function loadBookmarks() {
    try {
      return JSON.parse(localStorage.getItem('bookmarks') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveBookmarks(bookmarks) {
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
  }

  function getCurrentSnippet() {
    const scrollTop = readerContent.scrollTop;
    const paragraphs = readerContent.querySelectorAll('p, h2, h3');
    let snippet = '';
    for (const p of paragraphs) {
      if (p.offsetTop >= scrollTop - 20) {
        snippet = (p.textContent || '').trim();
        if (snippet.length > 0) break;
      }
    }
    if (snippet.length > 100) {
      snippet = snippet.substring(0, 100) + '...';
    }
    return snippet || '(본문 시작)';
  }

  function isBookmarkedHere() {
    if (!currentSutraId) return false;
    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;
    return bookmarks.some(b =>
      b.sutraId === currentSutraId &&
      Math.abs(b.scrollPos - currentScroll) < 100
    );
  }

  function updateBookmarkToggleButton() {
    if (isBookmarkedHere()) {
      btnToggleBookmark.classList.add('bookmark-active');
    } else {
      btnToggleBookmark.classList.remove('bookmark-active');
    }
  }

  function updateBookmarkIndicator() {
    const bookmarks = loadBookmarks();
    if (bookmarks.length > 0) {
      btnListBookmarks.classList.add('has-bookmarks');
    } else {
      btnListBookmarks.classList.remove('has-bookmarks');
    }
  }

  btnToggleBookmark.addEventListener('click', () => {
    if (!currentSutraId) return;
    const sutra = SUTRAS_DATA.find(s => s.id === currentSutraId);
    if (!sutra) return;

    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;
    const existingIdx = bookmarks.findIndex(b =>
      b.sutraId === currentSutraId &&
      Math.abs(b.scrollPos - currentScroll) < 100
    );

    if (existingIdx !== -1) {
      bookmarks.splice(existingIdx, 1);
      saveBookmarks(bookmarks);
      showToast('책갈피 제거됨');
    } else {
      const newBookmark = {
        id: Date.now().toString(),
        sutraId: currentSutraId,
        sutraTitle: sutra.title,
        scrollPos: currentScroll,
        snippet: getCurrentSnippet(),
        timestamp: Date.now()
      };
      bookmarks.unshift(newBookmark);
      saveBookmarks(bookmarks);
      showToast('책갈피 추가됨');
    }

    updateBookmarkToggleButton();
    updateBookmarkIndicator();
  });

  let toastTimer = null;
  function showToast(message) {
    bookmarkToast.textContent = message;
    bookmarkToast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      bookmarkToast.classList.remove('visible');
    }, 1800);
  }

  btnListBookmarks.addEventListener('click', () => {
    renderBookmarkList();
    bookmarkMenu.classList.add('active');
  });

  bookmarkMenu.addEventListener('click', e => {
    if (e.target === bookmarkMenu) bookmarkMenu.classList.remove('active');
  });

  function renderBookmarkList() {
    const bookmarks = loadBookmarks();
    if (bookmarks.length === 0) {
      bookmarkListContent.innerHTML = '<div class="bookmark-empty">아직 저장된 책갈피가 없습니다.<br><br>경전을 펴신 후 위쪽 책갈피 모양 버튼을 누르시면<br>현재 자리가 책갈피로 저장됩니다.</div>';
      return;
    }

    let html = '';
    bookmarks.forEach(b => {
      const date = new Date(b.timestamp);
      const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;
      html += `
        <div class="bookmark-item" data-id="${escapeHtml(b.id)}">
          <div class="bookmark-item-content" data-action="open">
            <div class="bookmark-item-sutra">${escapeHtml(b.sutraTitle)}</div>
            <div class="bookmark-item-snippet">${escapeHtml(b.snippet)}</div>
            <div class="bookmark-item-time">${dateStr}</div>
          </div>
          <button class="bookmark-item-delete" data-action="delete" aria-label="삭제">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      `;
    });
    bookmarkListContent.innerHTML = html;

    bookmarkListContent.querySelectorAll('.bookmark-item').forEach(item => {
      const bookmarkId = item.getAttribute('data-id');
      const contentArea = item.querySelector('[data-action="open"]');
      const deleteBtn = item.querySelector('[data-action="delete"]');

      contentArea.addEventListener('click', () => {
        const bookmarks = loadBookmarks();
        const bm = bookmarks.find(b => b.id === bookmarkId);
        if (bm) {
          bookmarkMenu.classList.remove('active');
          openSutra(bm.sutraId, bm.scrollPos);
        }
      });

      deleteBtn.addEventListener('click', e => {
        e.stopPropagation();
        const bookmarks = loadBookmarks();
        const idx = bookmarks.findIndex(b => b.id === bookmarkId);
        if (idx !== -1) {
          bookmarks.splice(idx, 1);
          saveBookmarks(bookmarks);
          renderBookmarkList();
          updateBookmarkIndicator();
          updateBookmarkToggleButton();
        }
      });
    });
  }

  // ── 초기화 ──
  buildList();
  applySettings();
  updateBookmarkIndicator();

})();
