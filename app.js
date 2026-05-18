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
  const btnFontSize = document.getElementById('btn-font-size');
  const btnScrollTop = document.getElementById('btn-scroll-top');

  const listContent = document.getElementById('list-content');
  const readerContent = document.getElementById('reader-content');
  const readerTitle = document.getElementById('reader-title');

  const fontMenu = document.getElementById('font-menu');
  const fontMenuButtons = fontMenu.querySelectorAll('button[data-size]');
  const bookmarkMenu = document.getElementById('bookmark-menu');
  const bookmarkListContent = document.getElementById('bookmark-list-content');
  const bookmarkToast = document.getElementById('bookmark-toast');

  let currentSutraId = null;
  let currentFontSize = localStorage.getItem('fontSize') || 'medium';

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

  // ── 경전 목록 만들기 ──
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
    applyFontSize(currentFontSize);
    currentSutraId = id;

    // 책갈피 상태 표시
    updateBookmarkToggleButton();

    // 스크롤 위치 정함 — 책갈피로 펴면 그 위치, 아니면 마지막 위치
    const savedScroll = scrollPos !== undefined ? scrollPos : parseInt(localStorage.getItem('scroll_' + id) || '0');
    showScreen(screenReader);
    requestAnimationFrame(() => {
      readerContent.scrollTop = savedScroll;
    });
  }

  // ── 스크롤 위치 저장 ──
  let scrollSaveTimer = null;
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
  });

  btnScrollTop.addEventListener('click', () => {
    readerContent.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ── 글씨 크기 ──
  function applyFontSize(size) {
    readerContent.classList.remove('font-small', 'font-medium', 'font-large', 'font-xlarge');
    readerContent.classList.add('font-' + size);
    fontMenuButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-size') === size);
    });
    currentFontSize = size;
    localStorage.setItem('fontSize', size);
  }

  btnFontSize.addEventListener('click', () => fontMenu.classList.add('active'));
  fontMenu.addEventListener('click', e => {
    if (e.target === fontMenu) fontMenu.classList.remove('active');
  });
  fontMenuButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const size = btn.getAttribute('data-size');
      applyFontSize(size);
      setTimeout(() => fontMenu.classList.remove('active'), 200);
    });
  });

  // ───────────────────────────────────────
  // 책갈피 기능
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

  // 지금 보이는 본문의 처음 부분을 snippet으로 뽑음
  function getCurrentSnippet() {
    const scrollTop = readerContent.scrollTop;
    const paragraphs = readerContent.querySelectorAll('p, h2, h3');
    let snippet = '';
    for (const p of paragraphs) {
      // 화면 안에 보이는 첫 단락 찾기
      if (p.offsetTop >= scrollTop - 20) {
        snippet = (p.textContent || '').trim();
        if (snippet.length > 0) break;
      }
    }
    // 너무 길지 않게
    if (snippet.length > 100) {
      snippet = snippet.substring(0, 100) + '...';
    }
    return snippet || '(본문 시작)';
  }

  // 현재 자리에 책갈피가 있는지
  function isBookmarkedHere() {
    if (!currentSutraId) return false;
    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;
    // 같은 경전, 같은 자리(±100px)에 책갈피가 있으면 있음으로 봄
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

  // 스크롤 중에도 책갈피 표시 갱신
  let bookmarkUpdateTimer = null;
  readerContent.addEventListener('scroll', () => {
    clearTimeout(bookmarkUpdateTimer);
    bookmarkUpdateTimer = setTimeout(updateBookmarkToggleButton, 300);
  });

  // 책갈피 토글
  btnToggleBookmark.addEventListener('click', () => {
    if (!currentSutraId) return;
    const sutra = SUTRAS_DATA.find(s => s.id === currentSutraId);
    if (!sutra) return;

    const bookmarks = loadBookmarks();
    const currentScroll = readerContent.scrollTop;

    // 가까운 자리에 책갈피가 있으면 제거
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
      bookmarks.unshift(newBookmark);  // 새 책갈피는 맨 위에
      saveBookmarks(bookmarks);
      showToast('책갈피 추가됨');
    }

    updateBookmarkToggleButton();
    updateBookmarkIndicator();
  });

  // 토스트 알림
  let toastTimer = null;
  function showToast(message) {
    bookmarkToast.textContent = message;
    bookmarkToast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      bookmarkToast.classList.remove('visible');
    }, 1800);
  }

  // 책갈피 목록 펴기
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

    // 클릭 이벤트
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
  applyFontSize(currentFontSize);
  updateBookmarkIndicator();

})();
